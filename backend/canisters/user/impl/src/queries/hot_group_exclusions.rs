use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::hot_group_exclusions::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn hot_group_exclusions(_args: Args) -> Response {
    read_state(|state| Success(user_core::queries::hot_group_exclusions(&state.data.user, state.env.now())))
}
