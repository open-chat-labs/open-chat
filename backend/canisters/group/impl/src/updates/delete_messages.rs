use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, DeleteMessageResult};
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;
use types::MessageUnpinned;
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

        if !runtime_state.data.events.are_messages_accessible(
            participant.min_visible_event_index(),
            args.thread_root_message_index,
            &args.message_ids,
        ) {
            return MessageNotFound;
        }

        if args.thread_root_message_index.is_none() {
            for message_id in args.message_ids.iter() {
                if let Some(message_index) = runtime_state
                    .data
                    .events
                    .main()
                    .message_internal_by_message_id(*message_id)
                    .map(|m| m.message_index)
                {
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

        let delete_message_results = runtime_state.data.events.delete_messages(
            user_id,
            participant.role.can_delete_messages(&runtime_state.data.permissions),
            args.thread_root_message_index,
            args.message_ids,
            args.correlation_id,
            now,
        );

        let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
        for (message_id, result) in delete_message_results {
            if matches!(result, DeleteMessageResult::Success) {
                runtime_state.data.timer_jobs.enqueue_job(
                    TimerJob::HardDeleteMessageContent(HardDeleteMessageContentJob {
                        thread_root_message_index: args.thread_root_message_index,
                        message_id,
                    }),
                    remove_deleted_message_content_at,
                    now,
                );
            }
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
