use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use community_canister::events_by_index::{Response::*, *};
use group_chat_core::EventsResult;
use ic_cdk_macros::query;

#[query]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    let caller = state.env.caller();
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if !state.data.is_public && user_id.is_none() {
        return UserNotInCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel
            .chat
            .events_by_index(user_id, args.thread_root_message_index, args.events)
        {
            EventsResult::Success(response) => Success(response),
            EventsResult::UserNotInGroup => UserNotInChannel,
            EventsResult::ThreadNotFound => ThreadNotFound,
        }
    } else {
        ChannelNotFound
    }
}
