use crate::guards::caller_is_user_index;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_canister::c2c_grant_super_admin::{Response::*, *};

#[update(guard = "caller_is_user_index")]
#[trace]
fn c2c_grant_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_grant_super_admin_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_grant_super_admin_impl(runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.is_super_admin = true;
    Success
}
