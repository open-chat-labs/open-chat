use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, TimerJob};
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use community_canister::send_message::{Response::*, *};
use group_chat_core::SendMessageResult;
use types::{
    CommunityGroupId, CommunityMessageNotification, EventWrapper, Message, MessageContent, MessageIndex, Notification,
    TimestampMillis,
};

#[update_candid_and_msgpack]
#[trace]
fn send_message(args: Args) -> Response {
    mutate_state(|state| send_message_impl(args, state))
}

fn send_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.members.get(caller).map(|m| m.user_id) {
        let now = state.env.now();

        if let Some(group) = state.data.groups.get_mut(&args.group_id) {
            match group.send_message(
                user_id,
                args.thread_root_message_index,
                args.message_id,
                args.content,
                args.replies_to,
                args.mentioned.clone(),
                args.forwarding,
                state.data.proposals_bot_user_id,
                now,
            ) {
                SendMessageResult::Success(result) => {
                    let event_index = result.message_event.index;
                    let message_index = result.message_event.event.message_index;
                    let expires_at = result.message_event.expires_at;

                    register_timer_jobs(
                        args.group_id,
                        args.thread_root_message_index,
                        &result.message_event,
                        now,
                        &mut state.data.timer_jobs,
                    );

                    let notification = Notification::CommunityMessageNotification(CommunityMessageNotification {
                        community_id: state.env.canister_id().into(),
                        group_id: args.group_id,
                        thread_root_message_index: args.thread_root_message_index,
                        community_name: state.data.name.clone(),
                        group_name: group.name.clone(),
                        sender: user_id,
                        sender_name: args.sender_name,
                        message: result.message_event,
                        mentioned: args.mentioned,
                    });

                    state.push_notification(result.users_to_notify, notification);

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
                SendMessageResult::UserNotInGroup => UserNotInGroup,
                SendMessageResult::UserSuspended => UserSuspended,
                SendMessageResult::InvalidRequest(error) => InvalidRequest(error),
            }
        } else {
            GroupNotFound
        }
    } else {
        CallerNotInCommunity
    }
}

fn register_timer_jobs(
    group_id: CommunityGroupId,
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    if let MessageContent::Poll(p) = &message_event.event.content {
        if let Some(end_date) = p.config.end_date {
            timer_jobs.enqueue_job(
                TimerJob::EndPoll(EndPollJob {
                    group_id,
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
}
