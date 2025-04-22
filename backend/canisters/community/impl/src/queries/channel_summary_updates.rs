use crate::RuntimeState;
use crate::model::channels::ChannelUpdates;
use crate::read_state;
use canister_api_macros::query;
use community_canister::channel_summary_updates::{Response::*, *};
use types::OCResult;

#[query(candid = true, msgpack = true)]
fn channel_summary_updates(args: Args) -> Response {
    read_state(|state| channel_summary_updates_impl(args, state)).unwrap_or_else(Error)
}

fn channel_summary_updates_impl(args: Args, state: &RuntimeState) -> OCResult<Response> {
    let caller = state.env.caller();
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let user_id = state.data.members.lookup_user_id(caller);

    state.data.verify_is_accessible(caller, args.invite_code)?;
    channel.chat.verify_is_accessible(user_id)?;

    if channel.last_updated(user_id) <= args.updates_since {
        return Ok(SuccessNoUpdates);
    }

    Ok(
        match channel.summary_updates(user_id, args.updates_since, state.data.is_public.value, &state.data.members) {
            ChannelUpdates::Added(s) => SuccessAdded(s),
            ChannelUpdates::Updated(s) => SuccessUpdated(s),
        },
    )
}
