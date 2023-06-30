use crate::{read_state, RuntimeState};
use community_canister::selected_channel_updates::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_channel_updates(args: Args) -> Response {
    read_state(|state| selected_channel_updates_impl(args, state))
}

fn selected_channel_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, None) {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let user_id = state.data.members.lookup_user_id(caller);

        match channel
            .chat
            .selected_group_updates_from_events(args.updates_since, user_id, state.env.now())
        {
            Some(updates) if updates.has_updates() => Success(updates),
            Some(_) => SuccessNoUpdates,
            None => PrivateChannel,
        }
    } else {
        ChannelNotFound
    }
}
