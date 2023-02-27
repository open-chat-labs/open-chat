use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{Event, SuperAdminStatusChanged};
use types::{ChatId, UserId};
use user_canister::c2c_revoke_super_admin;
use user_index_canister::remove_super_admin::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn remove_super_admin(args: Args) -> Response {
    if !read_state(|state| is_already_super_admin(&args.user_id, state)) {
        return NotSuperAdmin;
    }

    let c2c_args = c2c_revoke_super_admin::Args {};
    match user_canister_c2c_client::c2c_revoke_super_admin(args.user_id.into(), &c2c_args).await {
        Ok(result) => {
            let c2c_revoke_super_admin::Response::Success(success_result) = result;
            mutate_state(|state| commit(&args.user_id, success_result.groups_to_dismiss_user_from, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
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
    crate::jobs::dismiss_super_admins::start_job_if_required(runtime_state);

    runtime_state.data.push_event_to_all_local_user_indexes(
        Event::SuperAdminStatusChanged(SuperAdminStatusChanged {
            user_id: *user_id,
            is_super_admin: false,
        }),
        None,
    );
}
