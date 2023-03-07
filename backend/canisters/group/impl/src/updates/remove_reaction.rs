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
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.suspended.value {
            return UserSuspended;
        }
        if !participant.role.can_react_to_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        let now = runtime_state.env.now();
        let user_id = participant.user_id;
        let min_visible_event_index = participant.min_visible_event_index();

        match runtime_state.data.events.remove_reaction(AddRemoveReactionArgs {
            user_id,
            min_visible_event_index,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            reaction: args.reaction,
            correlation_id: args.correlation_id,
            now,
        }) {
            AddRemoveReactionResult::Success(r) => {
                handle_activity_notification(runtime_state);
                SuccessV2(r)
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        CallerNotInGroup
    }
}
