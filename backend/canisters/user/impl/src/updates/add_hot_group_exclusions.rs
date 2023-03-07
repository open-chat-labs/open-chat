use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::add_hot_group_exclusions::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn add_hot_group_exclusions(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_hot_group_exclusions_impl(args, state))
}

#[update(guard = "caller_is_owner")]
#[trace]
fn add_recommended_group_exclusions(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_hot_group_exclusions_impl(args, state))
}

fn add_hot_group_exclusions_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    for group in args.groups {
        runtime_state.data.hot_group_exclusions.add(group, args.duration, now);
    }
    Success
}
