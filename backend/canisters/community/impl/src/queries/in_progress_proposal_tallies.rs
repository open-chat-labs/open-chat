use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use community_canister::in_progress_proposal_tallies::{Response::*, *};
use types::OCResult;

#[query(msgpack = true)]
fn in_progress_proposal_tallies(args: Args) -> Response {
    match read_state(|state| in_progress_proposal_tallies_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn in_progress_proposal_tallies_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, args.invite_code)?;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;

    Ok(SuccessResult {
        tallies: channel.chat.events.in_progress_proposal_tallies(),
    })
}
