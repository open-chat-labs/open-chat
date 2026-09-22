use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_set_user_suspended::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_set_user_suspended(args: Args) -> Response {
    execute_update(|state| c2c_set_user_suspended_impl(args.suspended, state))
}

fn c2c_set_user_suspended_impl(suspended: bool, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    Success(user_core::updates::c2c_set_user_suspended(
        &mut state.data.user,
        suspended,
        now,
    ))
}
