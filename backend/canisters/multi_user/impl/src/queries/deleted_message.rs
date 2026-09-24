use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::deleted_message::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn deleted_message(args: Args) -> Response {
    match read_state(|state| {
        state.with_caller_user(|my_index, user| {
            user_core::queries::deleted_message(user, args, state.user_id(my_index), &state.data.migrated_user_ids)
        })
    }) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}
