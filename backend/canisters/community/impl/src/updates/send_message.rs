use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::model::members::CommunityMembers;
use crate::model::user_groups::UserGroup;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MarkP2PSwapExpiredJob, TimerJob};
use crate::{CommunityEventPusher, Data, RuntimeState, execute_update, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult, ai_app_card_content_hash_from_initial};
use community_canister::c2c_bot_send_message;
use community_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use community_canister::send_message::{Response::*, *};
use group_chat_core::SendMessageSuccess;
use itertools::Itertools;
use lazy_static::lazy_static;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use regex_lite::Regex;
use std::str::FromStr;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, ChannelId, ChannelMessageNotification, ChannelUserNotificationPayload,
    Chat, CommunityId, EventIndex, EventWrapper, IdempotentEnvelope, Message, MessageContent, MessageContentInitial,
    MessageIndex, OCResult, TimestampMillis, User, UserId, UserType, Version,
};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
async fn send_message(args: Args) -> Response {
    // Do not trace: an app ActionCard carries a live one-time provenance proof in its ingress args.
    let mut prepared = match read_state(|state| prepare_app_card_post(&args, state)) {
        Ok(value) => value,
        Err(error) => return Error(error),
    };
    if let Some(relay) = prepared.provenance.as_ref() {
        let chat_key = match relay.chat {
            Chat::Channel(community_id, channel_id) => format!("channel:{community_id}:{channel_id}"),
            _ => return Error(OCErrorCode::InvalidRequest.with_message("invalid channel card authority route")),
        };
        let binding = group_index_canister::ai_app_card_authority::AiAppCardAuthorityBindingV1 {
            local_user_index_canister_id: prepared.local_user_index_canister_id,
            context: types::AiAppCardContext {
                user_id: relay.user_id,
                chat: relay.chat,
                chat_key,
                thread_root_message_index: relay.thread_root_message_index,
                message_id: relay.message_id,
                app_id: relay.app_id,
                app_revision: relay.app_revision,
                action_id: relay.action_id.clone(),
            },
            content_hash: relay.content_hash,
            operation: group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::ValidateProvenance {
                provenance_hash: group_index_canister::ai_app_card_authority::opaque_hash_v1(
                    group_index_canister::ai_app_card_authority::OpaqueHashPurposeV1::Provenance,
                    &relay.provenance,
                ),
            },
        };
        let authority = match crate::ai_app_card_authority::issue(prepared.group_index_canister_id, binding).await {
            Ok(token) => token,
            Err(error) => return Error(error),
        };
        if let Err(error) = read_state(|state| revalidate_app_card_post(&prepared, state)) {
            return Error(error);
        }
        prepared.provenance.as_mut().unwrap().authority = authority;
    }
    let app_verified = if let Some(relay) = prepared.provenance.as_ref() {
        match local_user_index_canister_c2c_client::c2c_validate_ai_app_card_provenance(
            prepared.local_user_index_canister_id,
            relay,
        )
        .await
        {
            Ok(local_user_index_canister::c2c_validate_ai_app_card_provenance::Response::Success) => true,
            Ok(local_user_index_canister::c2c_validate_ai_app_card_provenance::Response::InvalidProvenance) => {
                return Error(OCErrorCode::InvalidRequest.with_message("invalid AI-app card provenance"));
            }
            Ok(local_user_index_canister::c2c_validate_ai_app_card_provenance::Response::AppUnavailable) => {
                return Error(OCErrorCode::InvalidRequest.with_message("AI app is unavailable"));
            }
            Ok(
                local_user_index_canister::c2c_validate_ai_app_card_provenance::Response::InvalidRequest(error)
                | local_user_index_canister::c2c_validate_ai_app_card_provenance::Response::Error(error),
            ) => {
                return Error(OCErrorCode::InvalidRequest.with_message(error));
            }
            Err(error) => return Error(OCErrorCode::C2CError.with_message(format!("{error:?}"))),
        }
    } else {
        false
    };
    // The provenance relay yielded through LocalUserIndex and UserIndex after the earlier
    // GroupIndex issuance check. Recheck the exact ingress caller, membership, local routes and app
    // enablement once more before committing the message.
    if app_verified && let Err(error) = read_state(|state| revalidate_app_card_post(&prepared, state)) {
        return Error(error);
    }
    let verified_app_card = app_verified.then_some(prepared.app_card).flatten();
    match execute_update(|state| send_message_impl_for_caller(args, prepared.caller, true, verified_app_card, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

struct AppCardPostPreparation {
    caller: Caller,
    local_user_index_canister_id: types::CanisterId,
    group_index_canister_id: types::CanisterId,
    provenance: Option<local_user_index_canister::c2c_validate_ai_app_card_provenance::Args>,
    app_card: Option<VerifiedAppCardPost>,
}

#[derive(Clone)]
struct VerifiedAppCardPost {
    ingress_caller: candid::Principal,
    principal_mapping_generation: u64,
    channel_id: ChannelId,
    user_id: UserId,
    app_id: types::AiAppId,
    app_revision: TimestampMillis,
    action_id: String,
    content_hash: [u8; 32],
    thread_root_message_index: Option<MessageIndex>,
    message_id: types::MessageId,
}

fn prepare_app_card_post(args: &Args, state: &RuntimeState) -> OCResult<AppCardPostPreparation> {
    let ingress_caller = state.env.caller();
    let caller = state.verified_caller(None)?;
    let (provenance, app_card) = match &args.content {
        MessageContentInitial::ActionCard(card)
            if card.app_id.is_some() || card.app_revision.is_some() || card.app_provenance.is_some() =>
        {
            let (Some(app_id), Some(app_revision), Some(provenance)) =
                (card.app_id, card.app_revision, card.app_provenance.clone())
            else {
                return Err(OCErrorCode::InvalidRequest.with_message("incomplete AI-app card provenance"));
            };
            if provenance.len() != 32 {
                return Err(OCErrorCode::InvalidRequest.with_message("invalid AI-app card provenance"));
            }
            let channel = state.data.channels.get_or_err(&args.channel_id)?;
            if !matches!(&caller, Caller::User(_)) || !channel.enabled_ai_apps.contains(&app_id) {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
            let user_id = caller.agent();
            let chat = Chat::Channel(state.env.canister_id().into(), args.channel_id);
            let content_hash = ai_app_card_content_hash_from_initial(
                user_id,
                chat,
                args.thread_root_message_index,
                args.message_id,
                app_id,
                app_revision,
                card,
            )
            .map_err(|error| OCErrorCode::InvalidRequest.with_message(error))?;
            let verified = VerifiedAppCardPost {
                ingress_caller,
                principal_mapping_generation: state.data.members.principal_mapping_generation(),
                channel_id: args.channel_id,
                user_id,
                app_id,
                app_revision,
                action_id: card.action_id.clone(),
                content_hash,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
            };
            (
                Some(local_user_index_canister::c2c_validate_ai_app_card_provenance::Args {
                    user_id,
                    chat,
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    app_id,
                    app_revision,
                    action_id: card.action_id.clone(),
                    content_hash,
                    member_user_ids: vec![user_id],
                    provenance,
                    authority: serde_bytes::ByteBuf::new(),
                }),
                Some(verified),
            )
        }
        _ => (None, None),
    };
    Ok(AppCardPostPreparation {
        caller,
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        group_index_canister_id: state.data.group_index_canister_id,
        provenance,
        app_card,
    })
}

fn revalidate_app_card_post(prepared: &AppCardPostPreparation, state: &RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;
    if state.data.local_user_index_canister_id != prepared.local_user_index_canister_id
        || state.data.group_index_canister_id != prepared.group_index_canister_id
    {
        return Err(OCErrorCode::C2CError.with_message("card authority route changed"));
    }
    if let Some(card) = &prepared.app_card {
        let channel = state.data.channels.get_or_err(&card.channel_id)?;
        if state.data.members.principal_mapping_generation() != card.principal_mapping_generation
            || state.data.members.lookup_user_id(card.ingress_caller) != Some(card.user_id)
            || !channel.enabled_ai_apps.contains(&card.app_id)
        {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        let member = state.data.members.get_verified_member(card.ingress_caller)?;
        if member.user_id != card.user_id || member.user_type != UserType::User {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        channel.chat.members.get_verified_member(card.user_id)?;
    }
    Ok(())
}

#[update(msgpack = true)]
#[trace]
fn c2c_send_message(args: C2CArgs) -> C2CResponse {
    match execute_update(|state| c2c_send_message_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_send_message(args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    execute_update(|state| c2c_bot_send_message_impl(args, state))
}

fn c2c_bot_send_message_impl(args: c2c_bot_send_message::Args, state: &mut RuntimeState) -> c2c_bot_send_message::Response {
    let finalised = args.finalised;
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };
    let args: Args = args.into();

    if !state.data.is_bot_permitted(
        &bot_caller.bot,
        Some(args.channel_id),
        &bot_caller.initiator,
        &BotPermissions::from_message_permission((&args.content).into()),
    ) {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }

    match send_message_impl(args, Some(Caller::BotV2(bot_caller)), finalised, state) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

pub(crate) fn send_message_impl(
    args: Args,
    ext_caller: Option<Caller>,
    finalised: bool,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    let caller = state.verified_caller(ext_caller)?;

    send_message_impl_for_caller(args, caller, finalised, None, state)
}

fn send_message_impl_for_caller(
    args: Args,
    caller: Caller,
    finalised: bool,
    verified_app_card: Option<VerifiedAppCardPost>,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    // App-card ingress awaited UserIndex validation. Recheck every mutable authorization input and
    // the immutable context snapshot immediately before the local channel mutation.
    if let Some(expected) = &verified_app_card {
        if !matches!(&caller, Caller::User(user_id) if *user_id == expected.user_id)
            || state.data.members.principal_mapping_generation() != expected.principal_mapping_generation
        {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        let member = state.data.members.get_verified_member(expected.ingress_caller)?;
        if member.user_id != expected.user_id || member.user_type != UserType::User {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        let channel = state.data.channels.get_or_err(&expected.channel_id)?;
        channel.chat.members.get_verified_member(expected.user_id)?;
        if !channel.enabled_ai_apps.contains(&expected.app_id) {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("AI app was disabled while validating"));
        }
        match &args.content {
            MessageContentInitial::ActionCard(card)
                if args.channel_id == expected.channel_id
                    && card.app_id == Some(expected.app_id)
                    && card.app_revision == Some(expected.app_revision)
                    && card.action_id == expected.action_id
                    && args.thread_root_message_index == expected.thread_root_message_index
                    && args.message_id == expected.message_id
                    && ai_app_card_content_hash_from_initial(
                        expected.user_id,
                        Chat::Channel(state.env.canister_id().into(), expected.channel_id),
                        args.thread_root_message_index,
                        args.message_id,
                        expected.app_id,
                        expected.app_revision,
                        card,
                    )
                    .is_ok_and(|hash| hash == expected.content_hash) => {}
            _ => return Err(OCErrorCode::InvalidRequest.with_message("AI-app card changed while validating")),
        }
    }

    let display_name = prepare(&caller, args.community_rules_accepted, state)?;

    let now = state.env.now();
    let mut content =
        match MessageContentInternal::validate_new_message(args.content, false, (&caller).into(), args.forwarding, now) {
            ValidateNewMessageContentResult::Success(content) => content,
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            _ => return Err(OCErrorCode::InvalidRequest.with_message("Message type not supported")),
        };
    if let Some(verified) = &verified_app_card
        && !content.mark_ai_app_card_verified(verified.content_hash)
    {
        return Err(OCErrorCode::InvalidRequest.with_message("provenance was supplied for a non-card message"));
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    if channel.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let users_mentioned = extract_users_mentioned(args.mentioned, content.text(), &state.data.members);

    let result = channel.chat.send_message(
        &caller,
        args.thread_root_message_index,
        args.message_id,
        content,
        args.replies_to,
        &users_mentioned.all_users_mentioned,
        args.forwarding,
        args.channel_rules_accepted,
        args.message_filter_failed.is_some(),
        args.block_level_markdown,
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
        finalised,
        args.og_previews,
        now,
    )?;

    Ok(process_send_message_result(
        result,
        &caller,
        args.sender_name,
        display_name.or(args.sender_display_name),
        channel.id,
        channel.chat.name.value.clone(),
        channel.chat.avatar.as_ref().map(|d| d.id),
        args.thread_root_message_index,
        users_mentioned,
        args.new_achievement,
        now,
        state,
    ))
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.verified_caller(None)?;

    let display_name = prepare(&caller, args.community_rules_accepted, state)?;

    // Bots can't call this c2c endpoint since it skips the validation
    if matches!(caller, Caller::Bot(_) | Caller::BotV2(_)) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let users_mentioned = extract_users_mentioned(args.mentioned, args.content.text(), &state.data.members);

        let result = channel.chat.send_message(
            &caller,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            &users_mentioned.all_users_mentioned,
            args.forwarding,
            args.channel_rules_accepted,
            args.message_filter_failed.is_some(),
            args.block_level_markdown,
            CommunityEventPusher {
                now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            },
            true,
            args.og_previews,
            now,
        )?;

        Ok(process_send_message_result(
            result,
            &caller,
            args.sender_name,
            display_name.or(args.sender_display_name),
            channel.id,
            channel.chat.name.value.clone(),
            channel.chat.avatar.as_ref().map(|d| d.id),
            args.thread_root_message_index,
            users_mentioned,
            false,
            now,
            state,
        ))
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

fn prepare(caller: &Caller, community_rules_accepted: Option<Version>, state: &mut RuntimeState) -> OCResult<Option<String>> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::CommunityFrozen.into());
    }

    let now = state.env.now();
    let sender = caller.agent();

    if let Some(version) = community_rules_accepted {
        state.data.members.mark_rules_accepted(&sender, version, now);
    }

    if caller.is_bot() {
        return Ok(None);
    }

    if let Some(member) = state.data.members.get_by_user_id(&sender) {
        if state.data.rules.enabled
            && !member.user_type.is_bot()
            && member
                .rules_accepted
                .as_ref()
                .is_none_or(|accepted| accepted.value < state.data.rules.text.version)
        {
            Err(OCErrorCode::CommunityRulesNotAccepted.into())
        } else {
            Ok(member.display_name().value.clone())
        }
    } else {
        Err(OCErrorCode::InitiatorNotInCommunity.into())
    }
}

#[expect(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageSuccess,
    caller: &Caller,
    sender_username: String,
    sender_display_name: Option<String>,
    channel_id: ChannelId,
    channel_name: String,
    channel_avatar_id: Option<u128>,
    thread_root_message_index: Option<MessageIndex>,
    users_mentioned: UsersMentioned,
    new_achievement: bool,
    now: TimestampMillis,
    state: &mut RuntimeState,
) -> SuccessResult {
    let message_event = &result.message_event;
    let event_index = message_event.index;
    let message_index = message_event.event.message_index;
    let message_id = message_event.event.message_id;
    let expires_at = message_event.expires_at;
    let content = &message_event.event.content;
    let community_id: CommunityId = state.env.canister_id().into();

    register_timer_jobs(channel_id, thread_root_message_index, message_event, now, &mut state.data);

    if state.data.is_public.value && state.data.channels.get(&channel_id).is_some_and(|c| c.chat.is_public.value) {
        let input = message_event.event.content.moderation_input();
        if !input.is_empty() {
            state.queue_message_for_moderation(channel_id, thread_root_message_index, message_id, input);
        }
        // Deliberately a sibling of the classification gate, not nested inside it: `input` is
        // empty for an image with no caption, which is exactly the message media scanning
        // must not skip
        let blobs = message_event.event.content.scannable_blobs();
        if !blobs.is_empty() {
            state.queue_media_for_scanning(channel_id, thread_root_message_index, message_id, blobs);
        }
    }

    if !result.unfinalised_bot_message {
        let sender = caller.agent();
        let message_text =
            content.notification_text(&users_mentioned.mentioned_directly, &users_mentioned.user_groups_mentioned);

        let notification = ChannelUserNotificationPayload::ChannelMessage(ChannelMessageNotification {
            community_id,
            channel_id,
            thread_root_message_index,
            message_index: message_event.event.message_index,
            event_index: message_event.index,
            community_name: state.data.name.value.clone(),
            channel_name,
            sender,
            sender_name: sender_username,
            sender_display_name,
            message_type: content.content_type().to_string(),
            message_text,
            image_url: content.notification_image_url(),
            file_name: content.notification_file_name(),
            community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
            channel_avatar_id,
            crypto_transfer: content.notification_crypto_transfer_details(&users_mentioned.mentioned_directly),
        });
        state.push_notification(Some(sender), result.users_to_notify, notification);

        if new_achievement && !caller.is_bot() {
            for a in result
                .message_event
                .event
                .achievements(false, thread_root_message_index.is_some())
            {
                state.notify_user_of_achievement(sender, a, now);
            }
        }

        let mut activity_events = Vec::new();

        if let MessageContent::Crypto(c) = &message_event.event.content {
            let recipient_is_human = state
                .data
                .members
                .get_by_user_id(&c.recipient)
                .is_some_and(|m| !m.user_type.is_bot());

            if recipient_is_human {
                state.notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto, now);

                activity_events.push((c.recipient, MessageActivity::Crypto));
            }
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            for user_id in users_mentioned.all_users_mentioned {
                if caller.initiator().map(|i| i != user_id).unwrap_or_default()
                    && channel.chat.members.get(&user_id).is_some_and(|m| !m.user_type().is_bot())
                {
                    activity_events.push((user_id, MessageActivity::Mention));
                }
            }

            if let Some(replying_to_event_index) = message_event
                .event
                .replies_to
                .as_ref()
                .filter(|r| r.chat_if_other.is_none())
                .map(|r| r.event_index)
                && let Some((message, _)) = channel.chat.events.message_internal(
                    EventIndex::default(),
                    thread_root_message_index,
                    replying_to_event_index.into(),
                )
                && caller.initiator().map(|i| i != message.sender).unwrap_or_default()
                && channel
                    .chat
                    .members
                    .get(&message.sender)
                    .is_some_and(|m| !m.user_type().is_bot())
            {
                activity_events.push((message.sender, MessageActivity::QuoteReply));
            }
        }

        for (user_id, activity) in activity_events {
            state.data.user_event_sync_queue.push(
                user_id,
                IdempotentEnvelope {
                    created_at: now,
                    idempotency_id: state.env.rng().next_u64(),
                    value: CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                        chat: Chat::Channel(community_id, channel_id),
                        thread_root_message_index,
                        message_index,
                        message_id,
                        event_index,
                        activity,
                        timestamp: now,
                        user_id: Some(sender),
                    }),
                },
            );
        }
    }

    state.push_bot_notification(result.bot_notification);

    handle_activity_notification(state);

    SuccessResult {
        event_index,
        message_index,
        timestamp: now,
        expires_at,
    }
}

fn register_timer_jobs(
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    now: TimestampMillis,
    data: &mut Data,
) {
    let files = message_event.event.content.blob_references();
    if !files.is_empty()
        && let Some(expiry) = message_event.expires_at
    {
        data.timer_jobs
            .enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
    }

    if let Some(expiry) = message_event.expires_at {
        data.handle_event_expiry(expiry, now);
    }

    match &message_event.event.content {
        MessageContent::Poll(p) => {
            if let Some(end_date) = p.config.end_date {
                data.timer_jobs.enqueue_job(
                    TimerJob::EndPoll(EndPollJob {
                        channel_id,
                        thread_root_message_index,
                        message_index: message_event.event.message_index,
                    }),
                    end_date,
                    now,
                );
            }
        }
        MessageContent::Prize(p) => {
            data.timer_jobs.enqueue_job(
                TimerJob::FinalPrizePayments(FinalPrizePaymentsJob {
                    channel_id,
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            data.timer_jobs.enqueue_job(
                TimerJob::MarkP2PSwapExpired(MarkP2PSwapExpiredJob {
                    channel_id,
                    thread_root_message_index,
                    message_id: message_event.event.message_id,
                }),
                c.expires_at,
                now,
            );
        }
        _ => {}
    }
}

lazy_static! {
    static ref USER_GROUP_REGEX: Regex = Regex::new(r"@UserGroup\((\d+)\)").unwrap();
}

struct UsersMentioned {
    mentioned_directly: Vec<User>,
    all_users_mentioned: Vec<UserId>,
    user_groups_mentioned: Vec<(u32, String)>,
}

fn extract_users_mentioned(mentioned: Vec<User>, text: Option<&str>, members: &CommunityMembers) -> UsersMentioned {
    let user_groups_mentioned = extract_user_groups_mentioned(text, members);
    let all_users_mentioned = mentioned
        .iter()
        .map(|u| u.user_id)
        .chain(user_groups_mentioned.iter().flat_map(|ug| ug.members.value.iter().copied()))
        .unique()
        .collect();

    UsersMentioned {
        mentioned_directly: mentioned,
        all_users_mentioned,
        user_groups_mentioned: user_groups_mentioned
            .iter()
            .map(|ug| (ug.id, ug.name.value.clone()))
            .collect(),
    }
}

fn extract_user_groups_mentioned<'a>(text: Option<&'a str>, members: &'a CommunityMembers) -> Vec<&'a UserGroup> {
    if let Some(text) = text
        && text.contains("@UserGroup")
    {
        return USER_GROUP_REGEX
            .captures_iter(text)
            .filter_map(|c| c.get(1))
            .filter_map(|m| u32::from_str(m.as_str()).ok())
            .filter_map(|id| members.get_user_group(id))
            .collect();
    }

    Vec::new()
}
