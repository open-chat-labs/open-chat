use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::messages_by_message_index::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{EventsCaller, MessagesResponse, OCResult};

#[query(candid = true, msgpack = true)]
fn messages_by_message_index(args: Args) -> Response {
    match read_state(|state| messages_by_message_index_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> OCResult<MessagesResponse> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let user_id = state.get_caller_user_id();
    let events_caller = user_id.map_or(EventsCaller::Unknown, EventsCaller::User);

    state
        .data
        .chat
        .messages_by_message_index(events_caller, args.thread_root_message_index, args.messages)
}
