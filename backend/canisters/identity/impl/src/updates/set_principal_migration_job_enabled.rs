use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::set_principal_migration_job_enabled::{Response::*, *};

#[update]
#[trace]
async fn set_principal_migration_job_enabled(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    assert!(
        user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id)
            .await
            .unwrap()
            .is_platform_operator
    );

    mutate_state(|state| set_principal_migration_job_enabled_impl(args.enabled, state))
}

fn set_principal_migration_job_enabled_impl(enabled: bool, state: &mut RuntimeState) -> Response {
    state.data.principal_migration_job_enabled = enabled;
    Success
}
