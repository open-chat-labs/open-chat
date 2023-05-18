use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{AddRemoveReactionArgs, AddRemoveReactionResult};
use group_canister::remove_reaction::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }
        if !member
            .role
            .can_react_to_messages(&runtime_state.data.group_chat_core.permissions)
        {
            return NotAuthorized;
        }

        let now = runtime_state.env.now();
        let user_id = member.user_id;
        let min_visible_event_index = member.min_visible_event_index();

        match runtime_state
            .data
            .group_chat_core
            .events
            .remove_reaction(AddRemoveReactionArgs {
                user_id,
                min_visible_event_index,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                reaction: args.reaction,
                now,
            }) {
            AddRemoveReactionResult::Success => {
                handle_activity_notification(runtime_state);
                Success
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        CallerNotInGroup
    }
}
