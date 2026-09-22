use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::TimestampMillis;
use user_canister::updates::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args.updates_since, state))
}

fn updates_impl(updates_since: TimestampMillis, state: &RuntimeState) -> Response {
    // `now` is only read if there are updates, so that caching works effectively
    match state
        .data
        .user
        .updates(updates_since, state.env.canister_id().into(), || state.env.now())
    {
        Some(result) => Success(result),
        None => SuccessNoUpdates,
    }
}
