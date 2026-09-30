use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::channel_members::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use types::OCResult;

#[query(msgpack = true)]
fn channel_members(args: Args) -> Response {
    match read_state(|state| channel_members_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn channel_members_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, None)?;

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let user_id = state.data.members.lookup_user_id(caller);
    channel.chat.verify_is_accessible(user_id)?;

    let max_results = args.max_results.clamp(1, MAX_MEMBERS_PER_QUERY);
    let page = channel.chat.members.page(args.after, Some(max_results));

    Ok(SuccessResult {
        members: page.members,
        basic_members: page.basic_members,
        more_members_after: page.more_members_after,
    })
}
