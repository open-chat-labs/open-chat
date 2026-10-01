use crate::queries::{check_replica_up_to_date, verify_community_is_accessible};
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::search_members::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

// Each member with a display name is read from stable memory, so a search of a community in which
// a great many members have display names stops once it has used this many instructions, and
// returns what it has found so far
const MAX_INSTRUCTIONS: u64 = 2_000_000_000;

#[query(msgpack = true)]
fn search_members(args: Args) -> Response {
    match read_state(|state| search_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn search_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    verify_community_is_accessible(args.invite_code, state)?;

    let mut checked: u32 = 0;
    let members = state
        .data
        .members
        .search_display_names(&args.search_term, args.max_results as usize, || {
            checked += 1;
            !checked.is_multiple_of(100) || ic_cdk::api::instruction_counter() < MAX_INSTRUCTIONS
        });

    Ok(SuccessResult { members })
}
