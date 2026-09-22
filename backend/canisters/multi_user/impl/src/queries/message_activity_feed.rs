use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::message_activity_feed::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn message_activity_feed(args: Args) -> Response {
    read_state(|state| state.with_caller_user(|_, user| Success(user_core::queries::message_activity_feed(user, args))))
}
