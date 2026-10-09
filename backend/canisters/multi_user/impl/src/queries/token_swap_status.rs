use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::token_swap_status::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn token_swap_status(args: Args) -> Response {
    match read_state(|state| state.with_caller_user(|_, user| user_core::queries::token_swap_status(user, args))) {
        Ok(status) => Success(status),
        Err(error) => Error(error),
    }
}
