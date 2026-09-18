use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::hot_group_exclusions::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn hot_group_exclusions(_args: Args) -> Response {
    read_state(hot_group_exclusions_impl)
}

fn hot_group_exclusions_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();

    Success(state.with_caller_user(|_, user| user.hot_group_exclusions.get_all(now).copied().collect()))
}
