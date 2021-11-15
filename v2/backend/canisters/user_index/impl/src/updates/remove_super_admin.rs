use crate::guards::caller_is_controller;
use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, UserId};
use user_canister::c2c_revoke_super_admin;
use user_index_canister::remove_super_admin::{Response::*, *};

#[update(guard = "caller_is_controller")]
#[trace]
async fn remove_super_admin(args: Args) -> Response {
    if !RUNTIME_STATE.with(|state| is_already_super_admin(&args.user_id, state.borrow().as_ref().unwrap())) {
        return NotSuperAdmin;
    }

    let c2c_args = c2c_revoke_super_admin::Args {};
    match user_canister_c2c_client::c2c_revoke_super_admin(args.user_id.into(), &c2c_args).await {
        Ok(result) => {
            let c2c_revoke_super_admin::Response::Success(success_result) = result;
            RUNTIME_STATE.with(|state| {
                commit(
                    &args.user_id,
                    success_result.groups_to_dismiss_user_from,
                    state.borrow_mut().as_mut().unwrap(),
                )
            });
            Success
        }
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

fn is_already_super_admin(user_id: &UserId, runtime_state: &RuntimeState) -> bool {
    runtime_state.data.super_admins.contains(user_id)
}

fn commit(user_id: &UserId, groups_to_dismiss_user_from: Vec<ChatId>, runtime_state: &mut RuntimeState) {
    runtime_state.data.super_admins.remove(user_id);

    for group_id in groups_to_dismiss_user_from {
        runtime_state.data.super_admins_to_dismiss.push_back((*user_id, group_id));
    }
}
