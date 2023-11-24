use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use community_canister::messages_by_message_index::{Response::*, *};
use group_chat_core::MessagesResult;
use ic_cdk_macros::query;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    let caller = state.env.caller();
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if user_id.is_none() && (!state.data.is_public || state.data.has_payment_gate()) {
        return UserNotInCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel
            .chat
            .messages_by_message_index(user_id, args.thread_root_message_index, args.messages)
        {
            MessagesResult::Success(response) => Success(response),
            MessagesResult::UserNotInGroup => UserNotInChannel,
            MessagesResult::ThreadNotFound => ThreadNotFound,
        }
    } else {
        ChannelNotFound
    }
}
