use crate::guards::caller_is_controller;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_index_canister::super_admins::{Response::*, *};

#[query(guard = "caller_is_controller")]
fn super_admins(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| super_admins_impl(state.borrow().as_ref().unwrap()))
}

fn super_admins_impl(runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: runtime_state.data.super_admins.iter().copied().collect(),
    })
}
