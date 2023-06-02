use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::init_user_principal_migration::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn init_user_principal_migration(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| init_user_principal_migration_impl(args, state))
}

fn init_user_principal_migration_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.pending_user_principal_migration = Some(args.new_principal);
    Success
}
