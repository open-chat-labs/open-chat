use crate::guards::caller_is_owner_or_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::{EventsResponse, OCResult};
use user_canister::events_by_index::{Response::*, *};

#[query(guard = "caller_is_owner_or_local_user_index", msgpack = true)]
fn events_by_index(args: Args) -> Response {
    match read_state(|state| events_by_index_impl(args, state)) {
        Ok(response) => Success(response),
        Err(error) => Error(error),
    }
}

fn events_by_index_impl(args: Args, state: &RuntimeState) -> OCResult<EventsResponse> {
    check_replica_up_to_date(args.latest_known_update, state)?;

    user_core::queries::events_by_index(&state.data.user, args, state.env.canister_id().into())
}
