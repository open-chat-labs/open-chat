use crate::guards::caller_is_user_index;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_canister::c2c_revoke_super_admin::*;

#[update(guard = "caller_is_user_index")]
#[trace]
fn c2c_revoke_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_revoke_super_admin_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_revoke_super_admin_impl(runtime_state: &mut RuntimeState) -> Response {
    let mut groups_to_dismiss_user_from = Vec::new();
    for group in runtime_state.data.group_chats.iter_mut().filter(|g| g.is_super_admin) {
        groups_to_dismiss_user_from.push(group.chat_id);
        group.is_super_admin = false;
    }

    runtime_state.data.is_super_admin = false;

    Response::Success(SuccessResult {
        groups_to_dismiss_user_from,
    })
}
