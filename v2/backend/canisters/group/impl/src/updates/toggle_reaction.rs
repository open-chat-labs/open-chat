use crate::model::events::ToggleReactionResult;
use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::toggle_reaction::{Response::*, *};
use ic_cdk_macros::update;

#[update]
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
            ToggleReactionResult::Added => {
                handle_activity_notification(runtime_state);
                Added
            }
            ToggleReactionResult::Removed => {
                handle_activity_notification(runtime_state);
                Removed
            }
            ToggleReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
