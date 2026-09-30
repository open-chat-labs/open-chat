use crate::queries::{check_replica_up_to_date, verify_channel_is_accessible};
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::channel_members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn channel_members(args: Args) -> Response {
    match read_state(|state| channel_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn channel_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    verify_channel_is_accessible(channel, state)?;

    let max_results = args.max_results.min(MAX_MEMBERS_PER_QUERY);
    let page = channel.chat.members.page(args.after, Some(max_results));

    Ok(SuccessResult {
        members: page.members,
        basic_members: page.basic_members,
        more_members_after: page.more_members_after,
    })
}
