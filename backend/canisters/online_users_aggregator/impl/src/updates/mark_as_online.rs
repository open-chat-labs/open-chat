use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use online_users_aggregator_canister::mark_as_online::{Response::*, *};

#[update]
#[trace]
fn mark_as_online(_args: Args) -> Response {
    mutate_state(mark_as_online_impl)
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    runtime_state.data.online_users.push(caller);
    runtime_state.data.mark_as_online_count += 1;
    Success
}
