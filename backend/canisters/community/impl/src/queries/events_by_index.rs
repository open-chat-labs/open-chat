use crate::guards::caller_is_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::query_msgpack;
use community_canister::c2c_events_by_index::Args as C2CArgs;
use community_canister::events_by_index::{Response::*, *};
use group_chat_core::EventsResult;
use ic_cdk::query;

#[query]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, None, state))
}

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_events_by_index(args: C2CArgs) -> Response {
    read_state(|state| events_by_index_impl(args.args, Some(args.caller), state))
}

fn events_by_index_impl(args: Args, on_behalf_of: Option<Principal>, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    let caller = on_behalf_of.unwrap_or_else(|| state.env.caller());
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if user_id.is_none() && (!state.data.is_public || state.data.gate.is_some()) {
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
