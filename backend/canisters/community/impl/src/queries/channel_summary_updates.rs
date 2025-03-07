use crate::model::channels::ChannelUpdates;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::channel_summary_updates::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn channel_summary_updates(args: Args) -> Response {
    read_state(|state| channel_summary_updates_impl(args, state))
}

fn channel_summary_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let user_id = state.data.members.lookup_user_id(caller);

        if !channel.chat.is_accessible(user_id) {
            return PrivateChannel;
        }

        if channel.last_updated(user_id) <= args.updates_since {
            return SuccessNoUpdates;
        }

        let is_community_member = state.data.members.get(caller).is_some();

        match channel.summary_updates(
            user_id,
            args.updates_since,
            is_community_member,
            state.data.is_public.value,
            &state.data.members,
        ) {
            ChannelUpdates::Added(s) => SuccessAdded(s),
            ChannelUpdates::Updated(s) => SuccessUpdated(s),
        }
    } else {
        ChannelNotFound
    }
}
