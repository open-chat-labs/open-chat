use crate::{read_state, RuntimeState};
use community_canister::selected_channel_updates::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_channel_updates(args: Args) -> Response {
    read_state(|state| selected_channel_updates_impl(args, state))
}

fn selected_channel_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    let member = match state.data.members.get(caller) {
        Some(m) => m,
        None => return UserNotInCommunity,
    };

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        if let Some(member) = channel.chat.members.get(&member.user_id) {
            let now = state.env.now();
            let updates = channel
                .chat
                .selected_group_updates_from_events(args.updates_since, member, now);

            if updates.has_updates() {
                Success(updates)
            } else {
                SuccessNoUpdates
            }
        } else {
            UserNotInChannel
        }
    } else {
        ChannelNotFound
    }
}
