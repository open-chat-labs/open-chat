use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::UndeleteMessageResult;
use group_canister::undelete_messages::{Response::*, *};
use ic_cdk_macros::update;
use std::collections::HashSet;

#[update]
#[trace]
fn undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| undelete_messages_impl(args, state))
}

fn undelete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
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

        let results = runtime_state.data.events.undelete_messages(
            user_id,
            participant.role.can_delete_messages(&runtime_state.data.permissions),
            args.thread_root_message_index,
            args.message_ids,
            args.correlation_id,
            now,
        );

        let chat_events = runtime_state.data.events.get(args.thread_root_message_index).unwrap();

        let mut message_ids = HashSet::new();
        let mut messages = Vec::new();
        for (message_id, result) in results {
            if matches!(result, UndeleteMessageResult::Success) {
                message_ids.insert(message_id);
                if let Some(message) = chat_events
                    .message_event_by_message_id(message_id, Some(participant.user_id))
                    .map(|e| e.event)
                {
                    messages.push(message);
                }
            }
        }

        if !message_ids.is_empty() {
            runtime_state.data.timer_jobs.cancel_jobs(|job| {
                if let TimerJob::HardDeleteMessageContent(j) = job {
                    j.thread_root_message_index == args.thread_root_message_index && message_ids.contains(&j.message_id)
                } else {
                    false
                }
            });
        }

        handle_activity_notification(runtime_state);

        Success(SuccessResult { messages })
    } else {
        CallerNotInGroup
    }
}
