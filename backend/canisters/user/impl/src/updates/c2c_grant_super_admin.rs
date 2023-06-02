use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_grant_super_admin::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_grant_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_grant_super_admin_impl)
}

fn c2c_grant_super_admin_impl(state: &mut RuntimeState) -> Response {
    state.data.is_platform_moderator = true;
    Success
}
