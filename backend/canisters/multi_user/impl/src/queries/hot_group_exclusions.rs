use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::hot_group_exclusions::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn hot_group_exclusions(_args: Args) -> Response {
    read_state(|state| {
        let now = state.env.now();
        Success(state.with_caller_user(|_, user| user_core::queries::hot_group_exclusions(user, now)))
    })
}
