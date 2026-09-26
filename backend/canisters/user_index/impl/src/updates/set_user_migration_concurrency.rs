use crate::guards::caller_is_platform_operator;
use crate::jobs::start_user_migrations;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::info;
use user_index_canister::set_user_migration_concurrency::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_user_migration_concurrency(args: Args) -> Response {
    mutate_state(|state| set_user_migration_concurrency_impl(args, state))
}

fn set_user_migration_concurrency_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.user_migrations.set_concurrency(args.value);
    start_user_migrations::run(state);

    info!("User migration concurrency set to {}", args.value);
    Response::Success
}
