use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::lookup_channel_members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use oc_error_codes::OCErrorCode;
use types::{GroupMember, OCResult};

#[query(msgpack = true)]
fn lookup_channel_members(args: Args) -> Response {
    match read_state(|state| lookup_channel_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn lookup_channel_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, None)?;

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let user_id = state.data.members.lookup_user_id(caller);
    channel.chat.verify_is_accessible(user_id)?;

    if args.user_ids.len() > MAX_MEMBERS_PER_QUERY as usize {
        return Err(OCErrorCode::TooManyUsers.with_message(MAX_MEMBERS_PER_QUERY));
    }

    let members = args
        .user_ids
        .iter()
        .filter_map(|user_id| channel.chat.members.get(user_id))
        .map(|member| GroupMember::from(&member))
        .collect();

    Ok(SuccessResult { members })
}
