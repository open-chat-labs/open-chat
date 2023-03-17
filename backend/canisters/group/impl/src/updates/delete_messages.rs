use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, DeleteMessageResult, DeleteUndeleteMessagesArgs, Reader};
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;
use std::collections::HashSet;
use types::{MessageId, MessageUnpinned};
use utils::time::MINUTE_IN_MS;

#[update]
#[trace]
fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_messages_impl(args, state))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.suspended.value {
            return UserSuspended;
        }

        let now = runtime_state.env.now();
        let user_id = participant.user_id;
        let min_visible_event_index = participant.min_visible_event_index();

        let mut my_messages: HashSet<MessageId> = HashSet::new();

        if args.thread_root_message_index.is_none() {
            for message_id in args.message_ids.iter().copied() {
                if let Some((message_index, sender)) = runtime_state
                    .data
                    .events
                    .visible_main_events_reader(min_visible_event_index, now)
                    .message_internal(message_id.into())
                    .map(|m| (m.message_index, m.sender))
                {
                    // Remember those messages where the deleter was also the sender
                    if sender == user_id {
                        my_messages.insert(message_id);
                    }

                    // If the message being deleted is pinned, unpin it
                    if let Ok(index) = runtime_state.data.pinned_messages.binary_search(&message_index) {
                        runtime_state.data.pinned_messages.remove(index);

                        runtime_state.data.events.push_main_event(
                            ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                                message_index,
                                unpinned_by: user_id,
                                due_to_message_deleted: true,
                            })),
                            args.correlation_id,
                            runtime_state.env.now(),
                        );
                    }
                }
            }
        }

        let delete_message_results = runtime_state.data.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: user_id,
            is_admin: participant.role.can_delete_messages(&runtime_state.data.permissions),
            min_visible_event_index,
            thread_root_message_index: args.thread_root_message_index,
            message_ids: args.message_ids,
            now,
        });

        let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
        for message_id in delete_message_results
            .into_iter()
            .filter(|(_, result)| matches!(result, DeleteMessageResult::Success))
            .map(|(message_id, _)| message_id)
            .filter(|message_id| my_messages.contains(message_id))
        {
            // After 5 minutes hard delete those messages where the deleter was the message sender
            runtime_state.data.timer_jobs.enqueue_job(
                TimerJob::HardDeleteMessageContent(HardDeleteMessageContentJob {
                    thread_root_message_index: args.thread_root_message_index,
                    message_id,
                }),
                remove_deleted_message_content_at,
                now,
            );
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
