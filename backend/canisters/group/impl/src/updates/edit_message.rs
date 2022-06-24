use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use group_canister::edit_message::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn edit_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| edit_message_impl(args, state))
}

fn edit_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();
        let sender = participant.user_id;

        if !runtime_state.data.is_message_accessible_by_id(
            participant.min_visible_event_index(),
            args.thread_root_message_index,
            args.message_id,
        ) {
            return MessageNotFound;
        }

        let chat_events = if let Some(thread_message_index) = args.thread_root_message_index {
            if let Some(thread_events) = runtime_state.data.threads.get_mut(&thread_message_index) {
                thread_events
            } else {
                return MessageNotFound;
            }
        } else {
            &mut runtime_state.data.events
        };

        let edit_message_args = EditMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content,
            now,
        };

        match chat_events.edit_message(edit_message_args) {
            EditMessageResult::Success(event_index) => {
                if let Some(thread_message_index) = args.thread_root_message_index {
                    runtime_state
                        .data
                        .events
                        .update_thread_summary(thread_message_index, sender, false, event_index, now);
                }

                handle_activity_notification(runtime_state);
                Success
            }
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        CallerNotInGroup
    }
}
