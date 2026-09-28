use crate::guards::caller_is_platform_operator;
use crate::jobs::start_user_migrations::{self, can_migrate};
use crate::model::user_migrations::QueuedUser;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use tracing::info;
use user_index_canister::migrate_users::{Response::*, *};

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn migrate_users(args: Args) -> Response {
    mutate_state(|state| migrate_users_impl(args, state))
}

fn migrate_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    let multi_user_canister_id = args.multi_user_canister_id;
    if multi_user_canister_id.is_some() && !state.data.test_mode {
        return Error(OCErrorCode::InitiatorNotAuthorized.with_message("Overriding the MultiUser canister is test only"));
    }

    let retry_failed = matches!(args.users, UsersToMigrate::Specific(_));
    let users: Vec<_> = match args.users {
        UsersToMigrate::LongestOffline(count) => {
            if !state.data.users_last_online.is_complete() {
                return Error(
                    OCErrorCode::NotReadyForMigration.with_message("Users' last online dates are still being fetched"),
                );
            }
            state.data.users_last_online.longest_offline(count as usize, |user_id| {
                !state.data.user_migrations.contains(user_id) && can_migrate(user_id, state)
            })
        }
        // Users named explicitly are queued even if they have failed to be migrated before
        UsersToMigrate::Specific(user_ids) => user_ids.into_iter().filter(|user_id| can_migrate(user_id, state)).collect(),
    };
    let queued: Vec<_> = users
        .into_iter()
        .filter(|user_id| {
            state.data.user_migrations.enqueue(
                QueuedUser {
                    user_id: *user_id,
                    multi_user_canister_id,
                },
                retry_failed,
            )
        })
        .collect();

    info!(count = queued.len(), "Users queued for migration");
    start_user_migrations::run(state);
    Success(SuccessResult { queued })
}
