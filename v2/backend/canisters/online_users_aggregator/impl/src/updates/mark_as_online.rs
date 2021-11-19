use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use online_users_aggregator_canister::mark_as_online::{Response::*, *};

#[update]
#[trace]
fn mark_as_online(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_as_online_impl(state.borrow_mut().as_mut().unwrap()))
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    runtime_state.data.online_users.push(caller);
    runtime_state.data.mark_as_online_count += 1;
    Success
}
