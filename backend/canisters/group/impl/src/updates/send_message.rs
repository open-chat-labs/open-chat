use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MarkP2PSwapExpiredJob};
use crate::{Data, GroupEventPusher, RuntimeState, TimerJob, execute_update, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult, ai_app_card_content_hash_from_initial};
use group_canister::c2c_bot_send_message;
use group_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageSuccess;
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, Chat, ChatId, EventIndex, EventWrapper, GroupChatUserNotificationPayload,
    GroupMessageNotification, Message, MessageContent, MessageContentInitial, MessageIndex, OCResult, TimestampMillis, User,
    UserType,
};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
async fn send_message_v2(args: Args) -> Response {
    // Do not trace: an app ActionCard carries a live one-time provenance proof in its ingress args.
    let mut prepared = match read_state(|state| prepare_app_card_post(&args, state)) {
        Ok(value) => value,
        Err(error) => return Error(error),
    };
    if let Some(relay) = prepared.provenance.as_ref() {
        let chat_key = match relay.chat {
            Chat::Group(chat_id) => format!("group:{chat_id}"),
            _ => return Error(OCErrorCode::InvalidRequest.with_message("invalid group card authority route")),
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
    user_id: types::UserId,
    app_id: types::AiAppId,
    app_revision: TimestampMillis,
    action_id: String,
    content_hash: [u8; 32],
    thread_root_message_index: Option<MessageIndex>,
    message_id: types::MessageId,
}

fn prepare_app_card_post(args: &Args, state: &RuntimeState) -> OCResult<AppCardPostPreparation> {
    state.data.verify_not_frozen()?;
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
            if !matches!(caller, Caller::User(_)) || !state.data.enabled_ai_apps.contains(&app_id) {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
            let user_id = caller.agent();
            let chat = Chat::Group(state.env.canister_id().into());
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
                principal_mapping_generation: state.data.principal_to_user_id_map.generation(),
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
        if state.data.principal_to_user_id_map.generation() != card.principal_mapping_generation
            || state.data.lookup_user_id(card.ingress_caller) != Some(card.user_id)
            || !state.data.enabled_ai_apps.contains(&card.app_id)
        {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        let member = state.data.chat.members.get_verified_member(card.user_id)?;
        if member.user_type() != UserType::User {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
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
    state.data.verify_not_frozen()?;

    if state.data.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

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
    // This function is entered after an inter-canister await for app cards. Every mutable gate that
    // authorized the proposal must be checked again immediately before storage.
    state.data.verify_not_frozen()?;
    if state.data.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }
    if let Some(expected) = &verified_app_card {
        if !matches!(&caller, Caller::User(user_id) if *user_id == expected.user_id)
            || state.data.principal_to_user_id_map.generation() != expected.principal_mapping_generation
            || state.data.lookup_user_id(expected.ingress_caller) != Some(expected.user_id)
        {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        let member = state.data.chat.members.get_verified_member(expected.user_id)?;
        if member.user_type() != UserType::User {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        if !state.data.enabled_ai_apps.contains(&expected.app_id) {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("AI app was disabled while validating"));
        }
        match &args.content {
            MessageContentInitial::ActionCard(card)
                if card.app_id == Some(expected.app_id)
                    && card.app_revision == Some(expected.app_revision)
                    && card.action_id == expected.action_id
                    && args.thread_root_message_index == expected.thread_root_message_index
                    && args.message_id == expected.message_id
                    && ai_app_card_content_hash_from_initial(
                        expected.user_id,
                        Chat::Group(state.env.canister_id().into()),
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

    let now = state.env.now();
    let mentioned: Vec<_> = args.mentioned.iter().map(|u| u.user_id).collect();

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

    let result = state.data.chat.send_message(
        &caller,
        args.thread_root_message_index,
        args.message_id,
        content,
        args.replies_to,
        &mentioned,
        args.forwarding,
        args.rules_accepted,
        args.message_filter_failed.is_some(),
        args.block_level_markdown,
        GroupEventPusher {
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
        args.sender_display_name,
        args.thread_root_message_index,
        args.mentioned,
        now,
        args.new_achievement,
        state,
    ))
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::ChatFrozen.into());
    }

    let caller = state.verified_caller(None)?;

    // Bots can't call this c2c endpoint since it skips the validation
    if matches!(caller, Caller::Bot(_) | Caller::BotV2(_)) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();
    let mentioned: Vec<_> = args.mentioned.iter().map(|u| u.user_id).collect();
    let result = state.data.chat.send_message(
        &caller,
        args.thread_root_message_index,
        args.message_id,
        args.content,
        args.replies_to,
        &mentioned,
        args.forwarding,
        args.rules_accepted,
        args.message_filter_failed.is_some(),
        args.block_level_markdown,
        GroupEventPusher {
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
        args.sender_display_name,
        args.thread_root_message_index,
        args.mentioned,
        now,
        false,
        state,
    ))
}

#[expect(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageSuccess,
    caller: &Caller,
    sender_username: String,
    sender_display_name: Option<String>,
    thread_root_message_index: Option<MessageIndex>,
    mentioned: Vec<User>,
    now: TimestampMillis,
    new_achievement: bool,
    state: &mut RuntimeState,
) -> SuccessResult {
    let message_event = &result.message_event;
    let event_index = message_event.index;
    let message_index = message_event.event.message_index;
    let message_id = message_event.event.message_id;
    let expires_at = message_event.expires_at;

    register_timer_jobs(thread_root_message_index, message_event, now, &mut state.data);

    if state.data.chat.is_public.value {
        let input = message_event.event.content.moderation_input();
        if !input.is_empty() {
            state.queue_message_for_moderation(thread_root_message_index, message_id, input);
        }
        // Deliberately a sibling of the classification gate, not nested inside it: `input` is
        // empty for an image with no caption, which is exactly the message media scanning
        // must not skip
        let blobs = message_event.event.content.scannable_blobs();
        if !blobs.is_empty() {
            state.queue_media_for_scanning(thread_root_message_index, message_id, blobs);
        }
    }

    if !result.unfinalised_bot_message {
        let chat_id: ChatId = state.env.canister_id().into();
        let sender = caller.agent();
        let content = &message_event.event.content;
        let notification = GroupChatUserNotificationPayload::GroupMessage(GroupMessageNotification {
            chat_id,
            thread_root_message_index,
            message_index,
            event_index,
            group_name: state.data.chat.name.value.clone(),
            sender,
            sender_name: sender_username,
            sender_display_name,
            message_type: content.content_type().to_string(),
            message_text: content.notification_text(&mentioned, &[]),
            image_url: content.notification_image_url(),
            file_name: content.notification_file_name(),
            group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
            crypto_transfer: content.notification_crypto_transfer_details(&mentioned),
        });
        state.push_notification(Some(sender), result.users_to_notify, notification);

        if new_achievement && !caller.is_bot() {
            for a in message_event.event.achievements(false, thread_root_message_index.is_some()) {
                state.notify_user_of_achievement(sender, a, now);
            }
        }

        let mut activity_events = Vec::new();

        if let MessageContent::Crypto(c) = content
            && state
                .data
                .chat
                .members
                .get(&c.recipient)
                .is_some_and(|m| !m.user_type().is_bot())
        {
            state.notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto, now);
            activity_events.push((c.recipient, MessageActivity::Crypto));
        }

        for user in mentioned {
            if caller.initiator().map(|i| i != user.user_id).unwrap_or_default()
                && state
                    .data
                    .chat
                    .members
                    .get(&user.user_id)
                    .is_some_and(|m| !m.user_type().is_bot())
            {
                activity_events.push((user.user_id, MessageActivity::Mention));
            }
        }

        if let Some(replying_to_event_index) = message_event
            .event
            .replies_to
            .as_ref()
            .filter(|r| r.chat_if_other.is_none())
            .map(|r| r.event_index)
            && let Some((message, _)) = state.data.chat.events.message_internal(
                EventIndex::default(),
                thread_root_message_index,
                replying_to_event_index.into(),
            )
            && caller.initiator().map(|i| i != message.sender).unwrap_or_default()
            && state
                .data
                .chat
                .members
                .get(&message.sender)
                .is_some_and(|m| !m.user_type().is_bot())
        {
            activity_events.push((message.sender, MessageActivity::QuoteReply));
        }

        for (user_id, activity) in activity_events {
            state.push_event_to_user(
                user_id,
                GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                    chat: Chat::Group(chat_id),
                    thread_root_message_index,
                    message_index,
                    message_id,
                    event_index,
                    activity,
                    timestamp: now,
                    user_id: Some(sender),
                }),
                now,
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
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            data.timer_jobs.enqueue_job(
                TimerJob::MarkP2PSwapExpired(MarkP2PSwapExpiredJob {
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
