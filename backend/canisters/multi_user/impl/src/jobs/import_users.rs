use crate::timer_job_types::{RemoveExpiredEventsJob, TimerJob};
use crate::{RuntimeState, jobs, mutate_state, read_state};
use constants::SECOND_IN_MS;
use ic_cdk_timers::TimerId;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::{OCError, OCErrorCode};
use stable_memory_map::{KeyScope, with_key_scope};
use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{Milliseconds, UserId};
use user_core::User;

// Few users are imported at once, since each page pulled is up to ~2MB
const MAX_IN_PROGRESS: usize = 2;
const MAX_FAILED_ATTEMPTS: u32 = 10;
const RETRY_DELAY: Milliseconds = 30 * SECOND_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    // The users whose next page is being pulled, of whom there is at most one call in flight each
    static IN_PROGRESS: RefCell<HashSet<UserId>> = RefCell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_some() || IN_PROGRESS.with_borrow(|p| p.len()) >= MAX_IN_PROGRESS {
        return false;
    }
    let now = state.env.now();
    let Some(next_due) = state
        .data
        .user_imports
        .iter()
        .filter(|(user_id, _)| !IN_PROGRESS.with_borrow(|p| p.contains(*user_id)))
        .map(|(_, import)| import.retry_after)
        .min()
    else {
        return false;
    };

    let delay = Duration::from_millis(next_due.saturating_sub(now));
    TIMER_ID.set(Some(ic_cdk_timers::set_timer(delay, async { run() })));
    true
}

fn run() {
    trace!("'import_users' job running");
    TIMER_ID.set(None);

    let user_ids = read_state(|state| {
        let now = state.env.now();
        let free = MAX_IN_PROGRESS.saturating_sub(IN_PROGRESS.with_borrow(|p| p.len()));
        state
            .data
            .user_imports
            .iter()
            .filter(|(user_id, import)| import.retry_after <= now && !IN_PROGRESS.with_borrow(|p| p.contains(*user_id)))
            .map(|(user_id, _)| *user_id)
            .take(free)
            .collect::<Vec<_>>()
    });

    for user_id in user_ids {
        IN_PROGRESS.with_borrow_mut(|p| p.insert(user_id));
        utils::async_work::spawn_tracked(pull_next_page(user_id));
    }
    read_state(start_job_if_required);
}

enum PullResult {
    MoreToPull,
    Complete,
    // The page may be pulled if tried again, eg. if the user's canister couldn't be reached
    Retry(OCError),
    Failed(OCError),
}

// Pulls the next page of the user, then once all of them have been pulled, the next page of their
// entries in the stable memory map, which are inserted under the user's index
async fn pull_next_page(user_id: UserId) {
    let result = pull_next_page_inner(user_id).await;
    IN_PROGRESS.with_borrow_mut(|p| p.remove(&user_id));

    mutate_state(|state| {
        match result {
            PullResult::MoreToPull => {
                if let Some(import) = state.data.user_imports.get_mut(&user_id) {
                    import.failed_attempts = 0;
                }
            }
            PullResult::Complete => complete_import(user_id, state),
            PullResult::Retry(error) => {
                let now = state.env.now();
                if let Some(import) = state.data.user_imports.get_mut(&user_id) {
                    import.failed_attempts += 1;
                    import.retry_after = now + RETRY_DELAY;
                    if import.failed_attempts >= MAX_FAILED_ATTEMPTS {
                        fail_import(user_id, error, state);
                    }
                }
            }
            PullResult::Failed(error) => fail_import(user_id, error, state),
        }
        start_job_if_required(state);
    });
}

async fn pull_next_page_inner(user_id: UserId) -> PullResult {
    let Some((index, from, user_pulled, after)) = read_state(|state| {
        state
            .data
            .user_imports
            .get(&user_id)
            .map(|i| (i.index, i.user.len() as u64, i.user_pulled, i.stable_memory_after.clone()))
    }) else {
        return PullResult::Failed(OCErrorCode::UserImportFailed.with_message("Import not found"));
    };
    let canister_id = user_id.canister_id();

    if !user_pulled {
        let result = match user_canister_c2c_client::c2c_export_user(
            canister_id,
            &user_canister::c2c_export_user::Args { from },
        )
        .await
        {
            Ok(user_canister::c2c_export_user::Response::Success(result)) => result,
            Err(error) => return PullResult::Retry(error.into()),
        };

        mutate_state(|state| {
            let Some(import) = state.data.user_imports.get_mut(&user_id) else {
                return PullResult::Failed(OCErrorCode::UserImportFailed.with_message("Import not found"));
            };
            let page_is_empty = result.page.is_empty();
            import.user.extend_from_slice(&result.page);

            if (import.user.len() as u64) < result.total_bytes && !page_is_empty {
                PullResult::MoreToPull
            } else if import.user.len() as u64 == result.total_bytes && sha256::sha256(&import.user) == result.hash {
                import.user_pulled = true;
                PullResult::MoreToPull
            } else {
                PullResult::Failed(OCErrorCode::UserImportFailed.with_message("The user pulled doesn't match their hash"))
            }
        })
    } else {
        let result = match user_canister_c2c_client::c2c_export_user_stable_memory(
            canister_id,
            &user_canister::c2c_export_user_stable_memory::Args { after },
        )
        .await
        {
            Ok(user_canister::c2c_export_user_stable_memory::Response::Success(result)) => result,
            Err(error) => return PullResult::Retry(error.into()),
        };

        let last_key = result.entries.last().map(|(key, _)| key.clone());
        let entries = result
            .entries
            .into_iter()
            .map(|(key, value)| (key.into_vec(), value.into_vec()))
            .collect();

        if let Err(key) = with_key_scope(KeyScope::User(index), || stable_memory_map::insert_raw_entries(entries)) {
            return PullResult::Failed(
                OCErrorCode::UserImportFailed.with_message(format!("Stable memory key of unknown type: {key:?}")),
            );
        }

        mutate_state(|state| {
            let Some(import) = state.data.user_imports.get_mut(&user_id) else {
                return PullResult::Failed(OCErrorCode::UserImportFailed.with_message("Import not found"));
            };
            if last_key.is_some() {
                import.stable_memory_after = last_key;
            }
            if result.finished { PullResult::Complete } else { PullResult::MoreToPull }
        })
    }
}

// Adds the user, now that everything has been pulled, moving what they hold under their old id onto
// their new one, then scheduling their timer jobs, and tells the LocalUserIndex they were imported
fn complete_import(old_user_id: UserId, state: &mut RuntimeState) {
    let Some(import) = state.data.user_imports.get(&old_user_id) else {
        return;
    };
    let index = import.index;
    let new_user_id = state.user_id(index);

    let mut user: User = match msgpack::deserialize(import.user.as_slice()) {
        Ok(user) => user,
        Err(error) => {
            let message = format!("Failed to deserialize the user: {error:?}");
            fail_import(old_user_id, OCErrorCode::UserImportFailed.with_message(message), state);
            return;
        }
    };
    with_key_scope(KeyScope::User(index), || {
        user.direct_chats.migrate_own_user_id(old_user_id, new_user_id)
    });
    let next_event_expiry = user.next_event_expiry;

    if state.data.users.add_imported(index, user).is_err() {
        let error = OCErrorCode::UserImportFailed.with_message("The user's principal is already registered");
        fail_import(old_user_id, error, state);
        return;
    }
    state.data.user_imports.remove(&old_user_id);
    state.data.migrated_user_ids.insert(old_user_id, new_user_id);

    let now = state.env.now();
    if let Some(expiry) = next_event_expiry {
        state.data.timer_jobs.enqueue_job(
            TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob { user_index: index }),
            expiry,
            now,
        );
    }
    state.set_up_streak_insurance_timer_job(index);

    state.push_local_user_index_canister_event(index, LocalUserIndexEvent::UserImported(old_user_id), now);
    info!(%old_user_id, %new_user_id, "User imported");
}

// Abandons the import, garbage collecting whatever was inserted into the stable memory map under the
// user's index, which is never reused, and tells the LocalUserIndex the user couldn't be imported
fn fail_import(old_user_id: UserId, error: OCError, state: &mut RuntimeState) {
    let Some(import) = state.data.user_imports.remove(&old_user_id) else {
        return;
    };
    error!(%old_user_id, ?error, "User import failed");

    state.data.deleted_users_to_garbage_collect.push(import.index);
    jobs::garbage_collect_stable_memory::start_job_if_required(&state.data);

    let now = state.env.now();
    state.push_local_user_index_canister_event(import.index, LocalUserIndexEvent::UserImportFailed(old_user_id, error), now);
}
