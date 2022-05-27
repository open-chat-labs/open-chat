use crate::model::participants::MakeSuperAdminResult;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_assume_super_admin::{Response::*, *};
use types::{CanisterId, ParticipantAssumesSuperAdmin, UserId};
use user_index_canister::c2c_is_super_admin;

#[update_candid_and_msgpack]
#[trace]
async fn c2c_assume_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = mutate_state(prepare);
    let user_id = prepare_result.user_id;

    let canister_id = prepare_result.user_index_canister_id;
    let is_super_admin_args = c2c_is_super_admin::Args { user_id };
    match user_index_canister_c2c_client::c2c_is_super_admin(canister_id, &is_super_admin_args).await {
        Ok(user_index_canister::c2c_is_super_admin::Response::Yes) => mutate_state(|state| commit(user_id, state)),
        Ok(user_index_canister::c2c_is_super_admin::Response::No) => NotSuperAdmin,
        Err(error) => InternalError(format!("Failed to call 'user_idex::c2c_is_super_admin': {error:?}")),
    }
}

struct PrepareResult {
    pub user_id: UserId,
    pub user_index_canister_id: CanisterId,
}

fn prepare(runtime_state: &mut RuntimeState) -> PrepareResult {
    PrepareResult {
        user_id: runtime_state.env.caller().into(),
        user_index_canister_id: runtime_state.data.user_index_canister_id,
    }
}

fn commit(user_id: UserId, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    match runtime_state.data.participants.make_super_admin(&user_id) {
        MakeSuperAdminResult::Success => {
            let event = ParticipantAssumesSuperAdmin { user_id };
            runtime_state
                .data
                .events
                .push_event(ChatEventInternal::ParticipantAssumesSuperAdmin(Box::new(event)), now);

            handle_activity_notification(runtime_state);
            Success
        }
        MakeSuperAdminResult::NotInGroup => CallerNotInGroup,
        MakeSuperAdminResult::AlreadySuperAdmin => Success,
        MakeSuperAdminResult::AlreadyOwner => AlreadyOwner,
    }
}
