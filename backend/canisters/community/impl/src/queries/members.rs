use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use types::OCResult;

#[query(msgpack = true)]
fn members(args: Args) -> Response {
    match read_state(|state| members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, args.invite_code)?;

    let max_results = args.max_results.clamp(1, MAX_MEMBERS_PER_QUERY);
    let page = state.data.members.page(args.after, Some(max_results));

    Ok(SuccessResult {
        members: page.members,
        basic_members: page.basic_members,
        more_members_after: page.more_members_after,
    })
}
