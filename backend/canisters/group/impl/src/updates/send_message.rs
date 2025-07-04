use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MarkP2PSwapExpiredJob};
use crate::{Data, GroupEventPusher, RuntimeState, TimerJob, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult};
use group_canister::c2c_bot_send_message;
use group_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageSuccess;
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, Chat, ChatId, EventIndex, EventWrapper, FcmData, GroupMessageNotification,
    Message, MessageContent, MessageIndex, OCResult, TimestampMillis, User, UserNotificationPayload,
};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn send_message_v2(args: Args) -> Response {
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

    let now = state.env.now();
    let mentioned: Vec<_> = args.mentioned.iter().map(|u| u.user_id).collect();

    let content =
        match MessageContentInternal::validate_new_message(args.content, false, (&caller).into(), args.forwarding, now) {
            ValidateNewMessageContentResult::Success(content) => content,
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            _ => return Err(OCErrorCode::InvalidRequest.with_message("Message type not supported")),
        };

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

    if !result.unfinalised_bot_message {
        let sender = caller.agent();
        let content = &message_event.event.content;
        let chat_id: ChatId = state.env.canister_id().into();
        let message_type = content.content_type().to_string();
        let message_text = content.notification_text(&mentioned, &[]);
        let group_avatar_id = state.data.chat.avatar.as_ref().map(|d| d.id);

        // TODO i18n
        let fcm_body = message_text.clone().unwrap_or(message_type.clone());
        let fcm_data = FcmData::for_group(chat_id)
            .set_body(fcm_body)
            .set_sender_name_with_alt(&sender_display_name, &sender_username)
            .set_avatar_id(group_avatar_id);

        let notification = UserNotificationPayload::GroupMessage(GroupMessageNotification {
            chat_id,
            thread_root_message_index,
            message_index,
            event_index,
            group_name: state.data.chat.name.value.clone(),
            sender,
            sender_name: sender_username,
            sender_display_name,
            message_type,
            message_text,
            image_url: content.notification_image_url(),
            group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
            crypto_transfer: content.notification_crypto_transfer_details(&mentioned),
        });
        state.push_notification(Some(sender), result.users_to_notify, notification, fcm_data);

        if new_achievement && !caller.is_bot() {
            for a in message_event.event.achievements(false, thread_root_message_index.is_some()) {
                state.notify_user_of_achievement(sender, a, now);
            }
        }

        let mut activity_events = Vec::new();

        if let MessageContent::Crypto(c) = content {
            if state
                .data
                .chat
                .members
                .get(&c.recipient)
                .is_some_and(|m| !m.user_type().is_bot())
            {
                state.notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto, now);
                activity_events.push((c.recipient, MessageActivity::Crypto));
            }
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
        {
            if let Some((message, _)) = state.data.chat.events.message_internal(
                EventIndex::default(),
                thread_root_message_index,
                replying_to_event_index.into(),
            ) {
                if caller.initiator().map(|i| i != message.sender).unwrap_or_default()
                    && state
                        .data
                        .chat
                        .members
                        .get(&message.sender)
                        .is_some_and(|m| !m.user_type().is_bot())
                {
                    activity_events.push((message.sender, MessageActivity::QuoteReply));
                }
            }
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
