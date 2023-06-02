use crate::{read_state, RuntimeState};
use community_canister::events::{Response::*, *};
use group_chat_core::EventsResult;
use ic_cdk_macros::query;

#[query]
fn events(args: Args) -> Response {
    read_state(|state| events_impl(args, state))
}

fn events_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if !state.data.is_public && user_id.is_none() {
        return UserNotInCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel.chat.events(
            user_id,
            args.thread_root_message_index,
            args.start_index,
            args.ascending,
            args.max_messages,
            args.max_events,
            args.latest_client_event_index,
            now,
        ) {
            EventsResult::Success(response) => Success(response),
            EventsResult::UserNotInGroup => UserNotInChannel,
            EventsResult::ThreadNotFound => ThreadNotFound,
            EventsResult::ReplicaNotUpToDate(event_index) => ReplicaNotUpToDate(event_index),
        }
    } else {
        ChannelNotFound
    }
}
