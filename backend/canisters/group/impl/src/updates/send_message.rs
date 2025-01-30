use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MarkP2PSwapExpiredJob};
use crate::{mutate_state, run_regular_jobs, CallerResult, Data, RuntimeState, TimerJob};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageResult;
use types::{
    Achievement, BotCaller, Caller, Chat, EventIndex, EventWrapper, GroupMessageNotification, Message, MessageContent,
    MessageIndex, Notification, TimestampMillis, User,
};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn send_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, None, state))
}

#[update(msgpack = true)]
#[trace]
fn c2c_send_message(args: C2CArgs) -> C2CResponse {
    run_regular_jobs();

    mutate_state(|state| c2c_send_message_impl(args, state))
}

pub(crate) fn send_message_impl(args: Args, bot: Option<BotCaller>, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = match state.verified_caller(bot) {
        CallerResult::Success(caller) => caller,
        CallerResult::NotFound => return CallerNotInGroup,
        CallerResult::Suspended => return UserSuspended,
    };

    let now = state.env.now();
    let mentioned: Vec<_> = args.mentioned.iter().map(|u| u.user_id).collect();
    let result = state.data.chat.validate_and_send_message(
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
        &mut state.data.event_store_client,
        now,
    );

    process_send_message_result(
        result,
        &caller,
        args.sender_name,
        args.sender_display_name,
        args.thread_root_message_index,
        args.mentioned,
        now,
        args.new_achievement,
        state,
    )
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> C2CResponse {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = match state.verified_caller(None) {
        CallerResult::Success(caller) => caller,
        CallerResult::NotFound => return CallerNotInGroup,
        CallerResult::Suspended => return UserSuspended,
    };

    // Bots can't call this c2c endpoint since it skips the validation
    if matches!(caller, Caller::Bot(_) | Caller::BotV2(_)) {
        return NotAuthorized;
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
        &mut state.data.event_store_client,
        now,
    );
    process_send_message_result(
        result,
        &caller,
        args.sender_name,
        args.sender_display_name,
        args.thread_root_message_index,
        args.mentioned,
        now,
        false,
        state,
    )
}

#[allow(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageResult,
    caller: &Caller,
    sender_username: String,
    sender_display_name: Option<String>,
    thread_root_message_index: Option<MessageIndex>,
    mentioned: Vec<User>,
    now: TimestampMillis,
    new_achievement: bool,
    state: &mut RuntimeState,
) -> Response {
    match result {
        SendMessageResult::Success(result) => {
            let message_event = &result.message_event;
            let event_index = message_event.index;
            let message_index = message_event.event.message_index;
            let message_id = message_event.event.message_id;
            let expires_at = message_event.expires_at;

            register_timer_jobs(thread_root_message_index, message_event, now, &mut state.data);

            if !result.unfinalised_bot_message {
                let sender = caller.agent();
                let content = &message_event.event.content;
                let chat_id = state.env.canister_id().into();

                let notification = Notification::GroupMessage(GroupMessageNotification {
                    chat_id,
                    thread_root_message_index,
                    message_index,
                    event_index,
                    group_name: state.data.chat.name.value.clone(),
                    sender,
                    sender_name: sender_username,
                    sender_display_name,
                    message_type: content.message_type(),
                    message_text: content.notification_text(&mentioned, &[]),
                    image_url: content.notification_image_url(),
                    group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
                    crypto_transfer: content.notification_crypto_transfer_details(&mentioned),
                });
                state.push_notification(Some(sender), result.users_to_notify, notification);

                if new_achievement && !caller.is_bot() {
                    for a in message_event.event.achievements(false, thread_root_message_index.is_some()) {
                        state.data.notify_user_of_achievement(sender, a);
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
                        state
                            .data
                            .notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto);

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
                    state.data.user_event_sync_queue.push(
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
                    );
                }
            }

            handle_activity_notification(state);

            Success(SuccessResult {
                event_index,
                message_index,
                timestamp: now,
                expires_at,
            })
        }
        SendMessageResult::ThreadMessageNotFound => ThreadMessageNotFound,
        SendMessageResult::MessageEmpty => MessageEmpty,
        SendMessageResult::TextTooLong(max_length) => TextTooLong(max_length),
        SendMessageResult::InvalidPoll(reason) => InvalidPoll(reason),
        SendMessageResult::NotAuthorized => NotAuthorized,
        SendMessageResult::UserNotInGroup => CallerNotInGroup,
        SendMessageResult::UserSuspended => UserSuspended,
        SendMessageResult::UserLapsed => NotAuthorized,
        SendMessageResult::RulesNotAccepted => RulesNotAccepted,
        SendMessageResult::MessageAlreadyExists => MessageAlreadyExists,
        SendMessageResult::InvalidRequest(error) => InvalidRequest(error),
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
