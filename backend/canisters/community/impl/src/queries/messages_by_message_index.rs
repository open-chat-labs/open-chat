use crate::{read_state, RuntimeState};
use community_canister::messages_by_message_index::{Response::*, *};
use group_chat_core::MessagesResult;
use ic_cdk_macros::query;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if !state.data.is_public && user_id.is_none() {
        return UserNotInCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel.chat.messages_by_message_index(
            user_id,
            args.thread_root_message_index,
            args.messages,
            args.latest_client_event_index,
            now,
        ) {
            MessagesResult::Success(response) => Success(response),
            MessagesResult::UserNotInGroup => UserNotInChannel,
            MessagesResult::ThreadNotFound => ThreadNotFound,
            MessagesResult::ReplicaNotUpToDate(event_index) => ReplicaNotUpToDate(event_index),
        }
    } else {
        ChannelNotFound
    }
}
