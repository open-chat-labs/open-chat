use crate::{read_state, RuntimeState};
use community_canister::selected_channel_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_channel_initial(args: Args) -> Response {
    read_state(|state| selected_channel_initial_impl(args, state))
}

fn selected_channel_initial_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, None) {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let user_id = state.data.members.lookup_user_id(caller);

        if !channel.chat.is_accessible(user_id) {
            return PrivateChannel;
        }

        let now = state.env.now();
        let chat = &channel.chat;

        Success(SuccessResult {
            timestamp: now,
            latest_event_index: chat.events.latest_event_index().unwrap_or_default(),
            members: chat.members.iter().map(|m| m.into()).collect(),
            blocked_users: chat.members.blocked(),
            invited_users: chat.invited_users.users(),
            pinned_messages: chat.pinned_messages.clone(),
            rules: chat.rules.clone(),
        })
    } else {
        ChannelNotFound
    }
}
