use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::model::members::CommunityMembers;
use crate::model::user_groups::UserGroup;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MarkP2PSwapExpiredJob, TimerJob};
use crate::{Data, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult};
use community_canister::c2c_bot_send_message;
use community_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use community_canister::send_message::{Response::*, *};
use group_chat_core::SendMessageSuccess;
use itertools::Itertools;
use lazy_static::lazy_static;
use oc_error_codes::OCErrorCode;
use rand::RngCore;
use regex_lite::Regex;
use std::str::FromStr;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, ChannelId, ChannelMessageNotification, Chat, EventIndex, EventWrapper,
    IdempotentEnvelope, Message, MessageContent, MessageIndex, OCResult, TimestampMillis, User, UserId,
    UserNotificationPayload, Version,
};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn send_message(args: Args) -> Response {
    match execute_update(|state| send_message_impl(args, None, true, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
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

    let display_name = prepare(&caller, args.community_rules_accepted, state)?;

    let now = state.env.now();
    let content =
        match MessageContentInternal::validate_new_message(args.content, false, (&caller).into(), args.forwarding, now) {
            ValidateNewMessageContentResult::Success(content) => content,
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            _ => return Err(OCErrorCode::InvalidRequest.with_message("Message type not supported")),
        };

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
        &mut state.data.event_store_client,
        finalised,
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
            &mut state.data.event_store_client,
            true,
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

#[allow(clippy::too_many_arguments)]
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
    let community_id = state.env.canister_id().into();

    register_timer_jobs(channel_id, thread_root_message_index, message_event, now, &mut state.data);

    if !result.unfinalised_bot_message {
        let sender = caller.agent();
        let notification = UserNotificationPayload::ChannelMessage(ChannelMessageNotification {
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
            message_type: content.message_type(),
            message_text: content
                .notification_text(&users_mentioned.mentioned_directly, &users_mentioned.user_groups_mentioned),
            image_url: content.notification_image_url(),
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
            {
                if let Some((message, _)) = channel.chat.events.message_internal(
                    EventIndex::default(),
                    thread_root_message_index,
                    replying_to_event_index.into(),
                ) {
                    if caller.initiator().map(|i| i != message.sender).unwrap_or_default()
                        && channel
                            .chat
                            .members
                            .get(&message.sender)
                            .is_some_and(|m| !m.user_type().is_bot())
                    {
                        activity_events.push((message.sender, MessageActivity::QuoteReply));
                    }
                }
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

    if let Some(bot_notification) = result.bot_notification {
        state.push_bot_notification(bot_notification);
    }

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
    if !files.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            data.timer_jobs
                .enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
        }
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
    if let Some(text) = text {
        if text.contains("@UserGroup") {
            return USER_GROUP_REGEX
                .captures_iter(text)
                .filter_map(|c| c.get(1))
                .filter_map(|m| u32::from_str(m.as_str()).ok())
                .filter_map(|id| members.get_user_group(id))
                .collect();
        }
    }

    Vec::new()
}
