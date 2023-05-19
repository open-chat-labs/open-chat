use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{DeleteUndeleteMessagesArgs, Reader, UndeleteMessageResult};
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
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = runtime_state.env.now();
        let user_id = member.user_id;
        let min_visible_event_index = member.min_visible_event_index();

        let results = runtime_state.data.chat.events.undelete_messages(DeleteUndeleteMessagesArgs {
            caller: user_id,
            is_admin: member.role.can_delete_messages(&runtime_state.data.chat.permissions),
            min_visible_event_index,
            thread_root_message_index: args.thread_root_message_index,
            message_ids: args.message_ids,
            now,
        });

        let events_reader = runtime_state
            .data
            .chat
            .events
            .events_reader(min_visible_event_index, args.thread_root_message_index, now)
            .unwrap();

        let mut message_ids = HashSet::new();
        let mut messages = Vec::new();
        for (message_id, result) in results {
            if matches!(result, UndeleteMessageResult::Success) {
                message_ids.insert(message_id);
                if let Some(message) = events_reader
                    .message_event_internal(message_id.into())
                    .map(|e| e.event.hydrate(Some(user_id)))
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
