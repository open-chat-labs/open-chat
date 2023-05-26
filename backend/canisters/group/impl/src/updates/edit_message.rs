use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use group_canister::edit_message_v2::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| edit_message_impl(args, state))
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();
        let sender = member.user_id;

        let edit_message_args = EditMessageArgs {
            sender,
            min_visible_event_index: member.min_visible_event_index(),
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content: args.content,
            now,
        };

        match state.data.chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => {
                handle_activity_notification(state);
                Success
            }
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        CallerNotInGroup
    }
}
