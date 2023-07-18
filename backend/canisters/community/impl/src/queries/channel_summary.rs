use crate::read_state;
use crate::RuntimeState;
use community_canister::channel_summary::{Response::*, *};
use ic_cdk_macros::query;

#[query]
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

        match channel.summary(user_id, state.env.now()) {
            Some(summary) => Success(summary),
            None => PrivateChannel,
        }
    } else {
        ChannelNotFound
    }
}
