use crate::{read_state, RuntimeState};
use community_canister::selected_channel_updates_v2::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_channel_updates(args: Args) -> community_canister::selected_channel_updates::Response {
    read_state(|state| selected_channel_updates_impl(args, state)).into()
}

#[query]
fn selected_channel_updates_v2(args: Args) -> Response {
    read_state(|state| selected_channel_updates_impl(args, state))
}

fn selected_channel_updates_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        // Short circuit prior to calling `ic0.caller()` and to maximise query caching.
        let latest_event_timestamp = channel.chat.events.latest_event_timestamp().unwrap_or_default();
        if latest_event_timestamp <= args.updates_since {
            return SuccessNoUpdates(latest_event_timestamp);
        }

        let caller = state.env.caller();
        if !state.data.is_accessible(caller, None) {
            return PrivateCommunity;
        }

        let user_id = state.data.members.lookup_user_id(caller);

        match channel.chat.selected_group_updates_from_events(args.updates_since, user_id) {
            Some(updates) if updates.has_updates() => Success(updates),
            Some(_) => SuccessNoUpdates(latest_event_timestamp),
            None => PrivateChannel,
        }
    } else {
        ChannelNotFound
    }
}
