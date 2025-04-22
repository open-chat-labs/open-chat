use crate::guards::caller_is_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::query;
use group_canister::c2c_events::Args as C2CArgs;
use group_canister::events::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{BotInitiator, EventsResponse, OCResult};

#[query(candid = true, msgpack = true)]
fn events(args: Args) -> Response {
    match read_state(|state| events_impl(args, None, None, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_events(args: C2CArgs) -> Response {
    match read_state(|state| events_impl(args.args, Some(args.caller), args.bot_initiator, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn events_impl(
    args: Args,
    on_behalf_of: Option<Principal>,
    bot_initiator: Option<BotInitiator>,
    state: &RuntimeState,
) -> OCResult<EventsResponse> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let caller = on_behalf_of.unwrap_or_else(|| state.env.caller());
    let Some(events_caller) = state.data.get_caller_for_events(caller, bot_initiator) else {
        return Err(OCErrorCode::InitiatorNotInChat.into());
    };

    state.data.chat.events(
        events_caller,
        args.thread_root_message_index,
        args.start_index,
        args.ascending,
        args.max_messages,
        args.max_events,
    )
}
