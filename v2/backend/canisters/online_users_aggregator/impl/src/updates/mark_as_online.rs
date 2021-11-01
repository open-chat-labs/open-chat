use crate::{RuntimeState, RUNTIME_STATE};
use online_users_agg_canister::mark_as_online::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn mark_as_online(_: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_as_online_impl(state.borrow_mut().as_mut().unwrap()))
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    runtime_state.data.online_users.push(caller);
    Success
}
