use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::lookup_members::{Response::*, *};
use types::OCResult;

#[query(candid = true, msgpack = true)]
fn lookup_members(args: Args) -> Response {
    match read_state(|state| lookup_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn lookup_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if !state.data.is_public.value {
        let caller = state.env.caller();
        state.data.verify_is_accessible(caller, None)?;
    }

    let members = args
        .user_ids
        .into_iter()
        .filter_map(|user_id| state.data.members.get_by_user_id(&user_id))
        .map(|member| member.clone().into())
        .collect();

    Ok(SuccessResult { members })
}
