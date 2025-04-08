use crate::guards::caller_is_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::query;
use community_canister::c2c_events_window::Args as C2CArgs;
use community_canister::events_window::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::{BotInitiator, EventsResponse};

#[query(candid = true, msgpack = true)]
fn events_window(args: Args) -> Response {
    match read_state(|state| events_window_impl(args, None, None, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_events_window(args: C2CArgs) -> Response {
    match read_state(|state| events_window_impl(args.args, Some(args.caller), args.bot_initiator, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn events_window_impl(
    args: Args,
    on_behalf_of: Option<Principal>,
    bot_initiator: Option<BotInitiator>,
    state: &RuntimeState,
) -> Result<EventsResponse, OCError> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let caller = on_behalf_of.unwrap_or_else(|| state.env.caller());
    let events_caller = state.data.get_caller_for_events(caller, args.channel_id, bot_initiator)?;

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        channel.chat.events_window(
            events_caller,
            args.thread_root_message_index,
            args.mid_point,
            args.max_messages,
            args.max_events,
        )
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
