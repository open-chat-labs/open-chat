use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ToggleReactionResult;
use group_canister::toggle_reaction::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| toggle_reaction_impl(args, state))
    } else {
        InvalidReaction
    }
}

fn toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        if !participant.role.can_react_to_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        match runtime_state
            .data
            .events
            .toggle_reaction(participant.user_id, args.message_id, args.reaction, now)
        {
            ToggleReactionResult::Added(e) => {
                handle_activity_notification(runtime_state);
                Added(e)
            }
            ToggleReactionResult::Removed(e) => {
                handle_activity_notification(runtime_state);
                Removed(e)
            }
            ToggleReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        CallerNotInGroup
    }
}
