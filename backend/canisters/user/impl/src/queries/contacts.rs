use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::contacts::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn contacts(_args: Args) -> Response {
    read_state(|state| Success(user_core::queries::contacts(&state.data.user)))
}
