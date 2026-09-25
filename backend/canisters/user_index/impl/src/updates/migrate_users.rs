use crate::guards::caller_is_platform_operator;
use crate::jobs::start_user_migrations::{self, can_migrate};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use tracing::info;
use user_index_canister::migrate_users::{Response::*, *};

// Only available in test mode until the MultiUser canister imports users, since until then a
// migrated user's canister stays frozen
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn migrate_users(args: Args) -> Response {
    mutate_state(|state| migrate_users_impl(args, state))
}

fn migrate_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    if !state.data.test_mode {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let can_queue = |user_id: &_| !state.data.user_migrations.contains(user_id) && can_migrate(user_id, state);
    let users = match args.users {
        UsersToMigrate::LongestOffline(count) => state.data.users_last_online.longest_offline(count as usize, can_queue),
        UsersToMigrate::Specific(user_ids) => user_ids.into_iter().filter(can_queue).collect(),
    };

    let queued: Vec<_> = users
        .into_iter()
        .filter(|user_id| state.data.user_migrations.enqueue(*user_id))
        .collect();

    info!(count = queued.len(), "Users queued for migration");
    start_user_migrations::run(state);
    Success(SuccessResult { queued })
}
