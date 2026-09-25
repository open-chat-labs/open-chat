use crate::jobs::upgrade_users;
use crate::model::users_to_migrate::UserToMigrate;
use crate::{RuntimeState, UserIndexEvent, mutate_state};
use constants::SECOND_IN_MS;
use ic_cdk_timers::TimerId;
use oc_error_codes::{OCError, OCErrorCode};
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};
use types::{CanisterId, Milliseconds, UserId};
use user_index_canister::{UserMigrationFailedToStart, UserMigrationStarted};
use utils::canister::{CanisterToInstall, install};

// Upgrades are the slow part, so this is kept low to limit how much this competes with the
// `upgrade_users` job
const MAX_IN_PROGRESS: usize = 5;
const MAX_ATTEMPTS: u32 = 20;
const RETRY_DELAY: Milliseconds = 30 * SECOND_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && let Some(next_due) = state.data.users_to_migrate.next_due(MAX_IN_PROGRESS)
    {
        let delay = next_due.saturating_sub(state.env.now());
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'start_user_migrations' running");
    TIMER_ID.set(None);

    let batch = mutate_state(|state| {
        let now = state.env.now();
        let batch = state.data.users_to_migrate.take_next_batch(MAX_IN_PROGRESS, now);
        // Schedule the next run for any users not yet due
        start_job_if_required(state);
        batch
    });
    for user in batch {
        utils::async_work::spawn_tracked(process_user(user));
    }
}

enum StartMigrationError {
    // The migration may succeed if tried again, eg. if the canister couldn't be reached
    Retry(OCError),
    Failed(OCError),
}

async fn process_user(user: UserToMigrate) {
    let result = start_migration(user.user_id, user.multi_user_canister_id).await;

    mutate_state(|state| {
        let user_id = user.user_id;
        let multi_user_canister_id = user.multi_user_canister_id;
        let now = state.env.now();
        state.data.users_to_migrate.mark_complete(&user_id);

        match result {
            Ok(result) => {
                info!(%user_id, %multi_user_canister_id, "User migration started");
                state.push_event_to_user_index(
                    UserIndexEvent::UserMigrationStarted(Box::new(UserMigrationStarted {
                        user_id,
                        multi_user_canister_id,
                        user_bytes: result.user_bytes,
                        wasm_version: result.wasm_version,
                    })),
                    now,
                );
            }
            Err(StartMigrationError::Retry(_)) if user.attempt + 1 < MAX_ATTEMPTS => {
                state.data.users_to_migrate.push(UserToMigrate {
                    attempt: user.attempt + 1,
                    not_before: now + RETRY_DELAY,
                    ..user
                });
            }
            Err(StartMigrationError::Retry(error) | StartMigrationError::Failed(error)) => {
                info!(%user_id, %multi_user_canister_id, ?error, "User migration failed to start");
                state.push_event_to_user_index(
                    UserIndexEvent::UserMigrationFailedToStart(Box::new(UserMigrationFailedToStart {
                        user_id,
                        multi_user_canister_id,
                        error,
                    })),
                    now,
                );
            }
        }

        start_job_if_required(state);
    });
}

// Upgrades the user's canister to the latest wasm if it is behind, so that the user is serialized
// by the latest version, then starts the migration, from when the canister is frozen
async fn start_migration(
    user_id: UserId,
    multi_user_canister_id: CanisterId,
) -> Result<user_canister::c2c_try_start_migration::SuccessResult, StartMigrationError> {
    if let Some(canister_to_upgrade) = mutate_state(|state| prepare_upgrade_if_required(user_id, state))? {
        let to_version = canister_to_upgrade.new_wasm_version;
        match install(canister_to_upgrade).await {
            Ok(top_up) => mutate_state(|state| upgrade_users::on_upgraded(user_id, to_version, top_up, state)),
            Err(error) => {
                mutate_state(|state| upgrade_users::mark_upgrade_complete(user_id, None, state));
                return Err(StartMigrationError::Retry(error.into()));
            }
        }
    }

    match user_canister_c2c_client::c2c_try_start_migration(
        user_id.canister_id(),
        &user_canister::c2c_try_start_migration::Args { multi_user_canister_id },
    )
    .await
    {
        Ok(user_canister::c2c_try_start_migration::Response::Success(result)) => Ok(result),
        // Most reasons for a canister not being ready clear by themselves, eg. work left over from
        // the upgrade above, so these are retried. Those which don't, such as the user having P2P
        // swaps, are reported once the attempts run out
        Ok(user_canister::c2c_try_start_migration::Response::Error(error))
            if error.matches_code(OCErrorCode::NotReadyForMigration) =>
        {
            Err(StartMigrationError::Retry(error))
        }
        Ok(user_canister::c2c_try_start_migration::Response::Error(error)) => Err(StartMigrationError::Failed(error)),
        Err(error) => Err(StartMigrationError::Retry(error.into())),
    }
}

fn prepare_upgrade_if_required(
    user_id: UserId,
    state: &mut RuntimeState,
) -> Result<Option<CanisterToInstall>, StartMigrationError> {
    if !user_id.is_canister() {
        return Err(StartMigrationError::Failed(
            OCErrorCode::TargetUserNotFound.with_message("User isn't in a canister of their own"),
        ));
    }
    let Some(user) = state.data.local_users.get(&user_id) else {
        return Err(StartMigrationError::Failed(OCErrorCode::TargetUserNotFound.into()));
    };
    if user.upgrade_in_progress {
        return Err(StartMigrationError::Retry(
            OCErrorCode::NotReadyForMigration.with_message("Canister upgrade in progress"),
        ));
    }

    Ok(upgrade_users::initialize_upgrade(user_id.canister_id(), false, state))
}
