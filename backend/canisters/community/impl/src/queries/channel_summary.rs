use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::channel_summary::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn channel_summary(args: Args) -> Response {
    read_state(|state| summary_impl(args, state))
}

fn summary_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let user_id = state.data.members.lookup_user_id(caller);
        let is_community_member = state.data.members.get(caller).is_some();

        match channel.summary(user_id, is_community_member, state.data.is_public.value, &state.data.members) {
            Some(summary) => Success(summary),
            None => PrivateChannel,
        }
    } else {
        ChannelNotFound
    }
}
