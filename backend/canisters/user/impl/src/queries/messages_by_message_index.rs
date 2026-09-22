use crate::guards::caller_is_owner;
use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::{MessagesResponse, OCResult};
use user_canister::messages_by_message_index::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn messages_by_message_index(args: Args) -> Response {
    match read_state(|state| messages_by_message_index_impl(args, state)) {
        Ok(response) => Success(response),
        Err(error) => Error(error),
    }
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> OCResult<MessagesResponse> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    user_core::queries::messages_by_message_index(&state.data.user, args, state.env.canister_id().into())
}
