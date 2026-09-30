use crate::queries::{check_replica_up_to_date, verify_community_is_accessible};
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::lookup_members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use itertools::Itertools;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn lookup_members(args: Args) -> Response {
    match read_state(|state| lookup_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn lookup_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    verify_community_is_accessible(args.invite_code, state)?;

    if args.user_ids.len() > MAX_MEMBERS_PER_QUERY as usize {
        return Err(OCErrorCode::TooManyUsers.with_message(MAX_MEMBERS_PER_QUERY));
    }

    let members = &state.data.members;
    let members = args
        .user_ids
        .iter()
        .unique()
        // So that the details are only read for users who are members
        .filter(|user_id| members.contains(user_id))
        .filter_map(|user_id| members.get_by_user_id(user_id))
        .map(|member| member.into())
        .collect();

    Ok(SuccessResult { members })
}
