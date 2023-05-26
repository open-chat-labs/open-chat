use crate::guards::caller_is_admin;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use sns1_airdrop::mark_completed::{Response::*, *};

#[update(guard = "caller_is_admin")]
#[trace]
fn mark_completed(_args: Args) -> Response {
    mutate_state(mark_completed_impl)
}

fn mark_completed_impl(state: &mut RuntimeState) -> Response {
    state.data.completed = true;
    Success
}
