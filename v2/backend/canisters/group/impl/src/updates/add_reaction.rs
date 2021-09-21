use crate::model::events::AddReactionResult;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::add_reaction::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn add_reaction(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        match runtime_state
            .data
            .events
            .add_reaction(participant.user_id, args.message_id, args.reaction, now)
        {
            AddReactionResult::MessageNotFound => MessageNotFound,
            _ => Success,
        }
    } else {
        ChatNotFound
    }
}
