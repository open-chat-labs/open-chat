use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_index_canister::user_migration::{Response::*, *};

#[query(guard = "caller_is_platform_operator", msgpack = true)]
fn user_migration(args: Args) -> Response {
    read_state(|state| user_migration_impl(args, state))
}

fn user_migration_impl(args: Args, state: &RuntimeState) -> Response {
    match state.data.user_migrations.status(&args.user_id) {
        Some(status) => Success(status),
        None => NotFound,
    }
}
