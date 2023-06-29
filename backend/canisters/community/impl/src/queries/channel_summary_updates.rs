use crate::model::channels::ChannelUpdates;
use crate::read_state;
use crate::RuntimeState;
use community_canister::channel_summary_updates::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn channel_summary_updates(args: Args) -> Response {
    read_state(|state| channel_summary_updates_impl(args, state))
}

fn channel_summary_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, None) {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let user_id = state.data.members.lookup_user_id(caller);

        if !channel.chat.is_accessible(user_id) {
            return PrivateChannel;
        }

        if !channel.chat.has_updates_since(user_id, args.updates_since) {
            return SuccessNoUpdates;
        }

        match channel.summary_updates(user_id, args.updates_since, state.env.now()) {
            ChannelUpdates::Added(s) => SuccessAdded(s),
            ChannelUpdates::Updated(s) => SuccessUpdated(s),
        }
    } else {
        ChannelNotFound
    }
}
