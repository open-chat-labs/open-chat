use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::token_swaps::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn token_swaps(args: Args) -> Response {
    read_state(|state| Success(user_core::queries::token_swaps(&state.data.user, args)))
}
