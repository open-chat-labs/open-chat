use crate::guards::caller_is_hosted_user_or_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::{EventsResponse, OCResult};
use user_canister::events_by_index::{Response::*, *};

#[query(guard = "caller_is_hosted_user_or_local_user_index", msgpack = true)]
fn events_by_index(args: Args) -> Response {
    match read_state(|state| events_by_index_impl(args, state)) {
        Ok(response) => Success(response),
        Err(error) => Error(error),
    }
}

// Reads the events of `args.user_id`'s chat with `args.them`, provided the caller may act as that user
fn events_by_index_impl(args: Args, state: &RuntimeState) -> OCResult<EventsResponse> {
    check_replica_up_to_date(args.latest_known_update, state)?;

    let user_id = args.user_id;
    let user_index = state.authorized_user_index(user_id)?;
    state
        .data
        .users
        .with_user(user_index, |user| user_core::queries::events_by_index(user, args, user_id))
        .ok_or(OCErrorCode::TargetUserNotFound)?
}
