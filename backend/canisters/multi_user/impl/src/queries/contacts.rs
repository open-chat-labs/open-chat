use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::contacts::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn contacts(_args: Args) -> Response {
    read_state(|state| state.with_caller_user(|_, user| Success(user_core::queries::contacts(user))))
}
