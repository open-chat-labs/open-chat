use crate::guards::caller_is_admin;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_prize_bot::stop::*;
use ic_cdk_macros::update;

#[update(guard = "caller_is_admin")]
#[trace]
fn stop(_args: Args) -> Response {
    mutate_state(stop_impl)
}

fn stop_impl(runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.started = false;
    Response::Success
}
