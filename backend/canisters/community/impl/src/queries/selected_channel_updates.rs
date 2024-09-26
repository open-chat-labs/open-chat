use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::selected_channel_updates_v2::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn selected_channel_updates_v2(args: Args) -> Response {
    read_state(|state| selected_channel_updates_impl(args, state))
}

fn selected_channel_updates_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let last_updated = channel.chat.details_last_updated();
        if last_updated <= args.updates_since {
            return SuccessNoUpdates(last_updated);
        }

        let caller = state.env.caller();
        if !state.data.is_accessible(caller, None) {
            return PrivateCommunity;
        }

        let user_id = state.data.members.lookup_user_id(caller);

        match channel.chat.selected_group_updates(args.updates_since, user_id) {
            Some(updates) if updates.has_updates() => Success(updates),
            Some(_) => SuccessNoUpdates(last_updated),
            None => PrivateChannel,
        }
    } else {
        ChannelNotFound
    }
}
