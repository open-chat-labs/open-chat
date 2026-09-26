use crate::model::users_to_migrate::UserToMigrate;
use crate::{RuntimeState, UserIndexEvent, mutate_state};
use constants::SECOND_IN_MS;
use ic_cdk_timers::TimerId;
use oc_error_codes::{OCError, OCErrorCode};
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};
use types::Milliseconds;
use user_index_canister::UserImportFailed;

const MAX_IN_PROGRESS: usize = 10;
const MAX_ATTEMPTS: u32 = 20;
const RETRY_DELAY: Milliseconds = 30 * SECOND_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Has each of this LocalUserIndex's MultiUser canisters import the users the UserIndex has asked
// it to, whose canisters have started migrating them. The MultiUser canister then pulls each user in
// the background, and reports whether they were imported through its events.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && let Some(next_due) = state.data.users_to_import.next_due(MAX_IN_PROGRESS)
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
    trace!("'import_users' running");
    TIMER_ID.set(None);

    let batch = mutate_state(|state| {
        let now = state.env.now();
        let batch = state.data.users_to_import.take_next_batch(MAX_IN_PROGRESS, now);
        // Schedule the next run for any users not yet due
        start_job_if_required(state);
        batch
    });
    for user in batch {
        utils::async_work::spawn_tracked(process_user(user));
    }
}

enum ImportError {
    // The call may succeed if tried again, eg. if the MultiUser canister couldn't be reached
    Retry(OCError),
    Failed(OCError),
}

async fn process_user(user: UserToMigrate) {
    let result = start_import(&user).await;

    mutate_state(|state| {
        let user_id = user.user_id;
        let multi_user_canister_id = user.multi_user_canister_id;
        let now = state.env.now();
        state.data.users_to_import.mark_complete(&user_id);

        match result {
            Ok(()) => {}
            Err(ImportError::Retry(_)) if user.attempt + 1 < MAX_ATTEMPTS => {
                state.data.users_to_import.push(UserToMigrate {
                    attempt: user.attempt + 1,
                    not_before: now + RETRY_DELAY,
                    ..user
                });
            }
            Err(ImportError::Retry(error) | ImportError::Failed(error)) => {
                info!(%user_id, %multi_user_canister_id, ?error, "User import failed to start");
                state.push_event_to_user_index(
                    UserIndexEvent::UserImportFailed(Box::new(UserImportFailed {
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

async fn start_import(user: &UserToMigrate) -> Result<(), ImportError> {
    let multi_user_canister_id = user.multi_user_canister_id;
    if !crate::read_state(|state| state.data.local_multi_user_canisters.contains(&multi_user_canister_id)) {
        return Err(ImportError::Failed(
            OCErrorCode::CanisterNotFound.with_message("Not one of this LocalUserIndex's MultiUser canisters"),
        ));
    }

    match multi_user_canister_c2c_client::c2c_import_user(
        multi_user_canister_id,
        &multi_user_canister::c2c_import_user::Args { user_id: user.user_id },
    )
    .await
    {
        Ok(multi_user_canister::c2c_import_user::Response::Success(new_user_id)) => {
            info!(user_id = %user.user_id, %new_user_id, "User import started");
            Ok(())
        }
        Ok(multi_user_canister::c2c_import_user::Response::Error(error)) => Err(ImportError::Failed(error)),
        Err(error) => Err(ImportError::Retry(error.into())),
    }
}
