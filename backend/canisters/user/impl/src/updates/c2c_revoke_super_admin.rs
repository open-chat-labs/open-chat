use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::c2c_revoke_super_admin::*;

#[update(guard = "caller_is_user_index")]
#[trace]
fn c2c_revoke_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_revoke_super_admin_impl)
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
