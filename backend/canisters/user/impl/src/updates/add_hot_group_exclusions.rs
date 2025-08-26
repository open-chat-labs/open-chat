use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::add_hot_group_exclusions::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn add_hot_group_exclusions(args: Args) -> Response {
    execute_update(|state| add_hot_group_exclusions_impl(args, state))
}

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn add_recommended_group_exclusions(args: Args) -> Response {
    execute_update(|state| add_hot_group_exclusions_impl(args, state))
}

fn add_hot_group_exclusions_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    for group in args.groups {
        state.data.hot_group_exclusions.add(group, args.duration, now);
    }
    user_index_canister::set_moderation_flags::Response::Success
}
