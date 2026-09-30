use crate::queries::{check_replica_up_to_date, verify_community_is_accessible};
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn members(args: Args) -> Response {
    match read_state(|state| members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    verify_community_is_accessible(args.invite_code, state)?;

    let max_results = args.max_results.min(MAX_MEMBERS_PER_QUERY);
    let page = state.data.members.page(args.after, Some(max_results));

    Ok(SuccessResult {
        members: page.members,
        basic_members: page.basic_members,
        more_members_after: page.more_members_after,
    })
}
