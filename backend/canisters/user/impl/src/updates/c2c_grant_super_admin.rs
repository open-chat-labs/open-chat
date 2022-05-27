use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_grant_super_admin::{Response::*, *};

#[update_candid_and_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_grant_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_grant_super_admin_impl)
}

fn c2c_grant_super_admin_impl(runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.is_super_admin = true;
    Success
}
