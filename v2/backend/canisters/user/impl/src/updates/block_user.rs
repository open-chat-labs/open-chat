use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::block_user::*;

#[update]
fn block_user(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| block_user_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn block_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    runtime_state.data.blocked_users.insert(args.user_id);
    Response::Success
}
