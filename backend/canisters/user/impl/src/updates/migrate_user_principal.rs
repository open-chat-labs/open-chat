use crate::{mutate_state, run_regular_jobs, Principal, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::CanisterId;
use user_canister::migrate_user_principal::{Response::*, *};
use user_index_canister::c2c_migrate_user_principal;

#[update]
#[trace]
async fn migrate_user_principal(_args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        caller,
        c2c_args,
        user_index_canister_id,
    } = match mutate_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::c2c_migrate_user_principal(user_index_canister_id, &c2c_args).await {
        Ok(response) => match response {
            c2c_migrate_user_principal::Response::Success => {
                mutate_state(|state| state.data.owner = caller);
                Success
            }
            c2c_migrate_user_principal::Response::SuccessNoChange => Success,
            c2c_migrate_user_principal::Response::UserNotFound => {
                InternalError("User not found. This should never happen!".to_string())
            }
            c2c_migrate_user_principal::Response::MigrationAlreadyInProgress => MigrationAlreadyInProgress,
            c2c_migrate_user_principal::Response::PrincipalAlreadyInUse => PrincipalAlreadyInUse,
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    c2c_args: c2c_migrate_user_principal::Args,
    user_index_canister_id: CanisterId,
}

fn prepare(state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    if state.data.pending_user_principal_migration == Some(caller) {
        state.data.pending_user_principal_migration = None;

        let c2c_args = user_index_canister::c2c_migrate_user_principal::Args {
            new_principal: caller,
            groups: state.data.group_chats.iter().map(|g| g.chat_id).collect(),
        };
        Ok(PrepareResult {
            caller,
            c2c_args,
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else {
        Err(MigrationNotInitialized)
    }
}
