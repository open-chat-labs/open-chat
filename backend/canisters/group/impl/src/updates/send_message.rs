use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::{
    DeleteFileReferencesJob, EndPollJob, MarkP2PSwapExpiredJob, RefundPrizeJob, RemoveExpiredEventsJob,
};
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_api_macros::{update_candid_and_msgpack, update_msgpack};
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use group_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageResult;
use types::{
    EventWrapper, GroupMessageNotification, Message, MessageContent, MessageIndex, Notification, TimestampMillis, User, UserId,
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
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        let user_id = member.user_id;
        let sender_is_bot = member.is_bot;
        let now = state.env.now();

        let result = state.data.chat.validate_and_send_message(
            user_id,
            sender_is_bot,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            args.mentioned.iter().map(|u| u.user_id).collect(),
            args.forwarding,
            args.rules_accepted,
            args.message_filter_failed.is_some(),
            state.data.proposals_bot_user_id,
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
            state,
        )
    } else {
        CallerNotInGroup
    }
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> C2CResponse {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        // Bots can't call this c2c endpoint since it skips the validation
        if member.is_bot && member.user_id != state.data.proposals_bot_user_id {
            return NotAuthorized;
        }
        let user_id = member.user_id;

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
            state,
        )
    } else {
        CallerNotInGroup
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
    state: &mut RuntimeState,
) -> Response {
    match result {
        SendMessageResult::Success(result) => {
            let event_index = result.message_event.index;
            let message_index = result.message_event.event.message_index;
            let expires_at = result.message_event.expires_at;

            let mut is_next_event_to_expire = false;
            if let Some(expiry) = expires_at {
                is_next_event_to_expire = state.data.next_event_expiry.map_or(true, |ex| expiry < ex);
                if is_next_event_to_expire {
                    state.data.next_event_expiry = expires_at;
                }
            }

            register_timer_jobs(
                thread_root_message_index,
                &result.message_event,
                is_next_event_to_expire,
                now,
                &mut state.data.timer_jobs,
            );

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
    is_next_event_to_expire: bool,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    let files = message_event.event.content.blob_references();
    if !files.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            timer_jobs.enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
        }
    }

    if let Some(expiry) = message_event.expires_at.filter(|_| is_next_event_to_expire) {
        timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
        timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
    }

    match &message_event.event.content {
        MessageContent::Poll(p) => {
            if let Some(end_date) = p.config.end_date {
                timer_jobs.enqueue_job(
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
            timer_jobs.enqueue_job(
                TimerJob::RefundPrize(RefundPrizeJob {
                    thread_root_message_index,
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            timer_jobs.enqueue_job(
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
