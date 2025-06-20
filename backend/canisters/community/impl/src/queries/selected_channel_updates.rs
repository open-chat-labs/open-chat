use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::selected_channel_updates_v2::{Response::*, *};
use types::OCResult;

#[query(candid = true, msgpack = true)]
fn selected_channel_updates_v2(args: Args) -> Response {
    read_state(|state| selected_channel_updates_impl(args, state)).unwrap_or_else(Error)
}

fn selected_channel_updates_impl(args: Args, state: &RuntimeState) -> OCResult<Response> {
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let last_updated = channel.details_last_updated();

    if last_updated <= args.updates_since {
        return Ok(SuccessNoUpdates(last_updated));
    }

    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, None)?;

    let user_id = state.data.members.lookup_user_id(caller);

    let updates = channel
        .chat
        .selected_group_updates(args.updates_since, last_updated, user_id)?;

    Ok(if updates.has_updates() { Success(updates) } else { SuccessNoUpdates(last_updated) })
}
