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
    let member = state.data.members.get(caller);
    let user_id = member.map(|m| &m.user_id);

    if member.is_none() && !state.data.is_public {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let channel_member = user_id.and_then(|id| channel.chat.members.get(id));

        if let Some(m) = channel_member {
            if !channel.chat.has_updates_since_by_user_id(&m.user_id, args.updates_since) {
                return SuccessNoUpdates;
            }
        } else {
            if !channel.chat.is_public {
                return PrivateChannel;
            }

            if !channel.chat.has_updates_since(None, args.updates_since) {
                return SuccessNoUpdates;
            }
        }

        match channel.summary_updates(user_id, args.updates_since, state.env.now()) {
            ChannelUpdates::Added(s) => SuccessAdded(s),
            ChannelUpdates::Updated(s) => SuccessUpdated(s),
        }
    } else {
        ChannelNotFound
    }
}
