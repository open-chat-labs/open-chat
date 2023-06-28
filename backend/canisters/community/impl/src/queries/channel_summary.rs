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
    let member = state.data.members.get(caller);

    if member.is_none() && !state.data.is_public {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let channel_member = member.and_then(|m| channel.chat.members.get(&m.user_id));

        if channel_member.is_none() && !channel.chat.is_public {
            return PrivateChannel;
        }

        Success(channel.summary(member.is_some(), channel_member, state.env.now()))
    } else {
        ChannelNotFound
    }
}
