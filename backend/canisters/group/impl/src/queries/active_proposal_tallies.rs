use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use group_canister::active_proposal_tallies::{Response::*, *};
use types::OCResult;

#[query(msgpack = true)]
fn active_proposal_tallies(args: Args) -> Response {
    match read_state(|state| active_proposal_tallies_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn active_proposal_tallies_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, args.invite_code)?;

    Ok(SuccessResult {
        tallies: state.data.chat.events.active_proposal_tallies(),
    })
}
