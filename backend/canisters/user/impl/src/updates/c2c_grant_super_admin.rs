use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_grant_super_admin::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_grant_super_admin(_args: Args) -> Response {
    execute_update(c2c_grant_super_admin_impl)
}

fn c2c_grant_super_admin_impl(state: &mut RuntimeState) -> Response {
    state.data.is_platform_moderator = true;
    Success
}
