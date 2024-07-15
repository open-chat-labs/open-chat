use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, MarkP2PSwapExpiredJob, RefundPrizeJob};
use crate::{mutate_state, run_regular_jobs, Data, RuntimeState, TimerJob};
use canister_api_macros::{update_candid_and_msgpack, update_msgpack};
use canister_tracing_macros::trace;
use group_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageResult;
use types::{
    Achievement, EventWrapper, GroupMessageNotification, Message, MessageContent, MessageIndex, Notification, TimestampMillis,
    User, UserId,
};

#[update_candid_and_msgpack]
#[trace]
fn send_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, state))
}

#[update_msgpack]
#[trace]
fn c2c_send_message(args: C2CArgs) -> C2CResponse {
    run_regular_jobs();

    mutate_state(|state| c2c_send_message_impl(args, state))
}

fn send_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    match validate_caller(state) {
        Ok(Caller { user_id, is_bot }) => {
            let now = state.env.now();

            let result = state.data.chat.validate_and_send_message(
                user_id,
                is_bot,
                args.thread_root_message_index,
                args.message_id,
                args.content,
                args.replies_to,
                args.mentioned.iter().map(|u| u.user_id).collect(),
                args.forwarding,
                args.rules_accepted,
                args.message_filter_failed.is_some(),
                state.data.proposals_bot_user_id,
                args.block_level_markdown,
                &mut state.data.event_store_client,
                now,
            );

            process_send_message_result(
                result,
                user_id,
                args.sender_name,
                args.sender_display_name,
                args.thread_root_message_index,
                args.mentioned,
                now,
                args.new_achievement,
                state,
            )
        }
        Err(response) => response,
    }
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> C2CResponse {
    match validate_caller(state) {
        Ok(Caller { user_id, is_bot }) => {
            // Bots can't call this c2c endpoint since it skips the validation
            if is_bot && user_id != state.data.proposals_bot_user_id {
                return NotAuthorized;
            }

            let now = state.env.now();
            let result = state.data.chat.send_message(
                user_id,
                args.thread_root_message_index,
                args.message_id,
                args.content,
                args.replies_to,
                args.mentioned.iter().map(|u| u.user_id).collect(),
                args.forwarding,
                args.rules_accepted,
                args.message_filter_failed.is_some(),
                state.data.proposals_bot_user_id,
                args.block_level_markdown,
                &mut state.data.event_store_client,
                now,
            );
            process_send_message_result(
                result,
                user_id,
                args.sender_name,
                args.sender_display_name,
                args.thread_root_message_index,
                args.mentioned,
                now,
                false,
                state,
            )
        }
        Err(response) => response,
    }
}

struct Caller {
    user_id: UserId,
    is_bot: bool,
}

fn validate_caller(state: &RuntimeState) -> Result<Caller, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else {
            Ok(Caller {
                user_id: member.user_id,
                is_bot: member.is_bot,
            })
        }
    } else {
        Err(CallerNotInGroup)
    }
}

#[allow(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageResult,
    sender: UserId,
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
            let event_index = result.message_event.index;
            let message_index = result.message_event.event.message_index;
            let expires_at = result.message_event.expires_at;

            register_timer_jobs(thread_root_message_index, &result.message_event, now, &mut state.data);

            let content = &result.message_event.event.content;
            let notification = Notification::GroupMessage(GroupMessageNotification {
                chat_id: state.env.canister_id().into(),
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
            state.push_notification(result.users_to_notify, notification);

            handle_activity_notification(state);

            if new_achievement {
                state.notify_user_of_achievements(sender, Achievement::from_message(false, &result.message_event.event));
            }

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
        SendMessageResult::RulesNotAccepted => RulesNotAccepted,
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
                TimerJob::RefundPrize(RefundPrizeJob {
                    thread_root_message_index,
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
