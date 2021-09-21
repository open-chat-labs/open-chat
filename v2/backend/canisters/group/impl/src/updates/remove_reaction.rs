use crate::model::events::RemoveReactionResult;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::remove_reaction::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn remove_reaction(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| remove_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        match runtime_state
            .data
            .events
            .remove_reaction(participant.user_id, args.message_id, args.reaction, now)
        {
            RemoveReactionResult::MessageNotFound => MessageNotFound,
            _ => Success,
        }
    } else {
        ChatNotFound
    }
}
