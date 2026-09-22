use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::TimestampMillis;
use user_canister::updates::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args.updates_since, state))
}

fn updates_impl(updates_since: TimestampMillis, state: &RuntimeState) -> Response {
    state.with_caller_user(|my_index, user| {
        // `now` is only read if there are updates, so that caching works effectively
        match user_core::queries::updates(user, updates_since, state.user_id(my_index), || state.env.now()) {
            Some(result) => Success(result),
            None => SuccessNoUpdates,
        }
    })
}
