use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use constants::MAX_MEMBERS_PER_QUERY;
use group_canister::lookup_members::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{GroupMember, OCResult};

#[query(msgpack = true)]
fn lookup_members(args: Args) -> Response {
    match read_state(|state| lookup_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn lookup_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    state.get_calling_member(None, false)?;

    if args.user_ids.len() > MAX_MEMBERS_PER_QUERY as usize {
        return Err(OCErrorCode::TooManyUsers.with_message(MAX_MEMBERS_PER_QUERY));
    }

    let members = args
        .user_ids
        .iter()
        .filter_map(|user_id| state.data.chat.members.get(user_id))
        .map(|member| GroupMember::from(&member))
        .collect();

    Ok(SuccessResult { members })
}
