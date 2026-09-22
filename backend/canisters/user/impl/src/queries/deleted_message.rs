use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::deleted_message::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn deleted_message(args: Args) -> Response {
    match read_state(|state| user_core::queries::deleted_message(&state.data.user, args, state.env.canister_id().into())) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}
