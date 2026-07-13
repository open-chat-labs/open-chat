use crate::{RuntimeState, mutate_state, read_state};
use constants::DAY_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, Milliseconds, TimestampMillis, UniquePersonProofProvider, UserId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Biometric retention limit. Illinois BIPA (740 ILCS 14/15(a)) requires
// biometric identifiers to be destroyed within 3 years of the individual's
// last interaction with us; other biometric statutes want the same shape.
// Purging a month early keeps the daily sweep comfortably inside the
// deadline. This limit is disclosed in the verification consent step and in
// Section H of the Terms - keep all three in step.
const RETENTION_LIMIT: Milliseconds = 3 * 365 * DAY_IN_MS - 30 * DAY_IN_MS;
const SWEEP_INTERVAL: Milliseconds = DAY_IN_MS;
const BATCH_SIZE: usize = 500;

// Removes the unique person proof (and, via the fan-out + verifier call, the
// face embedding and attempt history) of any OpenChat-provider verified user
// who has not interacted with OpenChat for RETENTION_LIMIT.
//
// Two-stage filter: cheap heap timestamps (proof issued / user record
// updated / chit earned) select candidates, then the online_users canister
// is queried for their real last-online time so recently-active lurkers are
// never purged. A user the online_users canister has no record of falls
// back to the heap timestamps, which already exceeded the limit.
pub(crate) fn start_job_if_required(_state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_millis(SWEEP_INTERVAL), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    let (candidates, online_users_canister_id, now) = read_state(|state| {
        let now = state.env.now();
        let candidates: Vec<UserId> = state
            .data
            .users
            .iter()
            .filter(|user| {
                user.unique_person_proof
                    .as_ref()
                    .is_some_and(|proof| matches!(proof.provider, UniquePersonProofProvider::OpenChat))
                    && latest_heap_activity(user) + RETENTION_LIMIT < now
            })
            .map(|user| user.user_id)
            .take(BATCH_SIZE)
            .collect();
        (candidates, state.data.online_users_canister_id, now)
    });

    if !candidates.is_empty() {
        ic_cdk::futures::spawn(confirm_and_purge(candidates, online_users_canister_id, now));
    }
}

fn latest_heap_activity(user: &crate::model::user::User) -> TimestampMillis {
    let proof_timestamp = user.unique_person_proof.as_ref().map_or(0, |p| p.timestamp);
    user.date_updated.max(user.chit_updated).max(proof_timestamp)
}

async fn confirm_and_purge(candidates: Vec<UserId>, online_users_canister_id: CanisterId, now: TimestampMillis) {
    // Confirm real inactivity with the online_users canister. If the call
    // fails, purge nothing - the next daily sweep retries.
    let args = online_users_canister::last_online::Args {
        user_ids: candidates.clone(),
    };
    let Ok(online_users_canister::last_online::Response::Success(last_online)) =
        online_users_canister_c2c_client::last_online(online_users_canister_id, &args).await
    else {
        return;
    };

    let recently_active: Vec<UserId> = last_online
        .iter()
        .filter(|u| u.duration_since_last_online < RETENTION_LIMIT)
        .map(|u| u.user_id)
        .collect();

    let to_purge: Vec<UserId> = candidates.into_iter().filter(|u| !recently_active.contains(u)).collect();

    if to_purge.is_empty() {
        return;
    }

    let count = to_purge.len();
    mutate_state(|state| {
        // Re-check under the write lock in case anything changed mid-flight
        let cutoff = now.saturating_sub(RETENTION_LIMIT);
        for user_id in to_purge {
            let still_stale = state.data.users.get_by_user_id(&user_id).is_some_and(|user| {
                user.unique_person_proof
                    .as_ref()
                    .is_some_and(|proof| matches!(proof.provider, UniquePersonProofProvider::OpenChat))
                    && latest_heap_activity(user) < cutoff
            });
            if still_stale {
                state.remove_unique_person_proof(user_id);
                state.delete_user_embedding(user_id);
            }
        }
    });
    info!(count, "Purged biometric data of long-inactive users");
}
