use crate::guards::caller_is_owner;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_canister::block_user::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn block_user(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| block_user_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn block_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.blocked_users.insert(args.user_id);
    Response::Success
}
