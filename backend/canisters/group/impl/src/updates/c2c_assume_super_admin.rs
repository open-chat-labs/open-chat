use crate::activity_notifications::handle_activity_notification;
use crate::model::participants::MakeSuperAdminResult;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_assume_super_admin::{Response::*, *};
use types::{CanisterId, ParticipantAssumesSuperAdmin, UserId};

#[update_msgpack]
#[trace]
async fn c2c_assume_super_admin(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = mutate_state(prepare);
    let user_id = prepare_result.user_id;

    let canister_id = prepare_result.local_user_index_canister_id;
    let c2c_args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: user_id.into(),
    };
    match local_user_index_canister_c2c_client::c2c_lookup_user(canister_id, &c2c_args).await {
        Ok(local_user_index_canister::c2c_lookup_user::Response::Success(r)) if r.is_super_admin => {
            mutate_state(|state| commit(user_id, args.correlation_id, state))
        }
        Ok(_) => NotSuperAdmin,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    pub user_id: UserId,
    pub local_user_index_canister_id: CanisterId,
}

fn prepare(runtime_state: &mut RuntimeState) -> PrepareResult {
    PrepareResult {
        user_id: runtime_state.env.caller().into(),
        local_user_index_canister_id: runtime_state.data.local_user_index_canister_id,
    }
}

fn commit(user_id: UserId, correlation_id: u64, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    match runtime_state.data.participants.make_super_admin(&user_id) {
        MakeSuperAdminResult::Success => {
            let event = ParticipantAssumesSuperAdmin { user_id };
            runtime_state.data.events.push_main_event(
                ChatEventInternal::ParticipantAssumesSuperAdmin(Box::new(event)),
                correlation_id,
                now,
            );

            handle_activity_notification(runtime_state);
            Success
        }
        MakeSuperAdminResult::NotInGroup => CallerNotInGroup,
        MakeSuperAdminResult::AlreadySuperAdmin => Success,
        MakeSuperAdminResult::AlreadyOwner => AlreadyOwner,
    }
}
