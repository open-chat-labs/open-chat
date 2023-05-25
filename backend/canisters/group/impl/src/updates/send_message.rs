use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob};
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_api_macros::update_candid_and_msgpack;
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use group_canister::send_message_v2::{Response::*, *};
use group_chat_core::SendMessageResult;
use types::{EventWrapper, GroupMessageNotification, Message, MessageContent, MessageIndex, Notification, TimestampMillis};

#[update_candid_and_msgpack]
#[trace]
fn send_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, state))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.lookup_user_id(&caller) {
        let now = runtime_state.env.now();

        match runtime_state.data.chat.send_message(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            args.mentioned.clone(),
            args.forwarding,
            runtime_state.data.proposals_bot_user_id,
            now,
        ) {
            SendMessageResult::Success(result) => {
                let event_index = result.message_event.index;
                let message_index = result.message_event.event.message_index;
                let expires_at = result.message_event.expires_at;

                register_timer_jobs(
                    args.thread_root_message_index,
                    &result.message_event,
                    now,
                    &mut runtime_state.data.timer_jobs,
                );

                let notification = Notification::GroupMessageNotification(GroupMessageNotification {
                    chat_id: runtime_state.env.canister_id().into(),
                    thread_root_message_index: args.thread_root_message_index,
                    group_name: runtime_state.data.chat.name.clone(),
                    sender: user_id,
                    sender_name: args.sender_name,
                    message: result.message_event,
                    mentioned: args.mentioned,
                });

                runtime_state.push_notification(result.users_to_notify, notification);
                handle_activity_notification(runtime_state);

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
            SendMessageResult::InvalidRequest(error) => InvalidRequest(error),
        }
    } else {
        CallerNotInGroup
    }
}

fn register_timer_jobs(
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    if let MessageContent::Poll(p) = &message_event.event.content {
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

    let files = message_event.event.content.blob_references();
    if !files.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            timer_jobs.enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
        }
    }

    // TODO: If this is a prize message then set a timer to transfer
    // the balance of any remaining prizes to the original sender
}
