use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::message_activity_feed::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn message_activity_feed(args: Args) -> Response {
    read_state(|state| Success(user_core::queries::message_activity_feed(&state.data.user, args)))
}
