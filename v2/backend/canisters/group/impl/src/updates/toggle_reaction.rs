use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::ToggleReactionResult;
use cycles_utils::check_cycles_balance;
use group_canister::toggle_reaction::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;

#[update]
#[instrument(level = "trace", skip_all)]
fn toggle_reaction(args: Args) -> Response {
    check_cycles_balance();

    if args.reaction.is_valid() {
        RUNTIME_STATE.with(|state| toggle_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
    } else {
        InvalidReaction
    }
}

fn toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

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
