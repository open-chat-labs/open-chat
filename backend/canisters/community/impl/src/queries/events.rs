use crate::guards::caller_is_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::query;
use community_canister::c2c_events::Args as C2CArgs;
use community_canister::events::{Response::*, *};
use group_chat_core::EventsResult;

#[query(candid = true, msgpack = true)]
fn events(args: Args) -> Response {
    read_state(|state| events_impl(args, None, None, state))
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_events(args: C2CArgs) -> Response {
    read_state(|state| events_impl(args.args, Some(args.caller), args.bot_api_key_secret, state))
}

fn events_impl(
    args: Args,
    on_behalf_of: Option<Principal>,
    bot_api_key_secret: Option<String>,
    state: &RuntimeState,
) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    let caller = on_behalf_of.unwrap_or_else(|| state.env.caller());
    let events_caller = match state.data.get_caller_for_events(caller, args.channel_id, bot_api_key_secret) {
        Ok(ec) => ec,
        Err(response) => return response,
    };

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel.chat.events(
            events_caller,
            args.thread_root_message_index,
            args.start_index,
            args.ascending,
            args.max_messages,
            args.max_events,
        ) {
            EventsResult::Success(response) => Success(response),
            EventsResult::UserNotInGroup => UserNotInChannel,
            EventsResult::ThreadNotFound => ThreadNotFound,
            EventsResult::UserSuspended => UserSuspended,
            EventsResult::UserLapsed => UserLapsed,
        }
    } else {
        ChannelNotFound
    }
}
