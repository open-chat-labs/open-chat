use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::add_hot_group_exclusions::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn add_hot_group_exclusions(args: Args) -> Response {
    mutate_state(|state| add_hot_group_exclusions_impl(args, state))
}

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn add_recommended_group_exclusions(args: Args) -> Response {
    mutate_state(|state| add_hot_group_exclusions_impl(args, state))
}

fn add_hot_group_exclusions_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user_core::updates::add_hot_group_exclusions(user, args, now));
    Response::Success
}
