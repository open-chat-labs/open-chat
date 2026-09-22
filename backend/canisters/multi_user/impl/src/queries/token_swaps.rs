use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::token_swaps::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn token_swaps(args: Args) -> Response {
    read_state(|state| state.with_caller_user(|_, user| Success(user_core::queries::token_swaps(user, args))))
}
