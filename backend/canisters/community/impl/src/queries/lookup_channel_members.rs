use crate::queries::{check_replica_up_to_date, verify_channel_is_accessible};
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::lookup_channel_members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use itertools::Itertools;
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
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    verify_channel_is_accessible(channel, state)?;

    if args.user_ids.len() > MAX_MEMBERS_PER_QUERY as usize {
        return Err(OCErrorCode::TooManyUsers.with_message(MAX_MEMBERS_PER_QUERY));
    }

    let members = &channel.chat.members;
    let members = args
        .user_ids
        .iter()
        .unique()
        // So that the details are only read for users who are members
        .filter(|user_id| members.contains(user_id))
        .filter_map(|user_id| members.get(user_id))
        .map(|member| GroupMember::from(&member))
        .collect();

    Ok(SuccessResult { members })
}
