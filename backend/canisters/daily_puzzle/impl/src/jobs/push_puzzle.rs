//! Delivers the current day's puzzles to every local user index. A refresh re-reads the set from
//! the registry and targets all of them; an index whose push fails stays in `pending_pushes` and
//! is retried with a backoff, and given up on after a while. Giving up is safe: every index pulls
//! for itself every 15 minutes while it holds no puzzle for the day, so a push is only ever the
//! fast path.

use crate::{RuntimeState, mutate_state, read_state, registry};
use ic_cdk_timers::TimerId;
use local_user_index_canister::c2c_daily_puzzle_push;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::{C2CError, UnitResult};
use utils::canister::delay_if_should_retry_failed_c2c_call;

const RETRY_DELAY: Duration = Duration::from_secs(60);
const MAX_RETRY_DELAY: Duration = Duration::from_secs(15 * 60);
// Roughly an hour of retries. An index still failing after that is stopped, uninstalled or on a
// wasm without the endpoint, and re-sending it the full puzzle every minute until midnight only
// floods the error log.
const MAX_ATTEMPTS: u32 = 8;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    // Bumped every time `pending_pushes` is rebuilt, and captured by each run at its start. A run
    // whose responses arrive after a newer run has rebuilt the set leaves it alone: its successes
    // would otherwise remove entries the newer run still owes, and the newer run's failure to the
    // same index would then never be retried.
    static GENERATION: Cell<u64> = Cell::default();
    // Consecutive runs that left something in `pending_pushes`, for the backoff
    static ATTEMPTS: Cell<u32> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_pushes.is_empty() {
        schedule(false, Duration::ZERO);
        true
    } else {
        false
    }
}

pub(crate) fn schedule(refresh: bool, delay: Duration) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let timer_id = ic_cdk_timers::set_timer(delay, async move { run(refresh) });
    TIMER_ID.set(Some(timer_id));
}

fn run(refresh: bool) {
    TIMER_ID.set(None);
    ic_cdk::futures::spawn_migratory(push(refresh));
}

fn retry_delay(attempt: u32) -> Duration {
    RETRY_DELAY.saturating_mul(1 << attempt.min(4)).min(MAX_RETRY_DELAY)
}

async fn push(refresh: bool) {
    if refresh {
        if let Err(error) = registry::refresh_local_user_indexes().await {
            error!(?error, "Failed to refresh local user indexes from the registry");
            if read_state(|state| state.data.local_user_indexes.is_empty()) {
                schedule(true, RETRY_DELAY);
                return;
            }
        }
        mutate_state(|state| state.data.pending_pushes = state.data.local_user_indexes.clone());
        GENERATION.set(GENERATION.get() + 1);
        ATTEMPTS.set(0);
    }
    let generation = GENERATION.get();

    let (puzzles, targets) = read_state(|state| {
        (
            state
                .data
                .current_puzzles(state.env.now())
                .into_iter()
                .cloned()
                .collect::<Vec<_>>(),
            state.data.pending_pushes.iter().copied().collect::<Vec<_>>(),
        )
    });
    if puzzles.is_empty() {
        // Nothing for the current number: the gap between `regenerate_today` dropping today's
        // puzzle and its replacement being generated. Indexes still owed a push keep their place
        // in the queue - clearing it forgets the ones that never received the last puzzle, and the
        // refresh push that follows the replacement is the only thing that would have put them
        // back.
        if !targets.is_empty() {
            schedule(false, RETRY_DELAY);
        }
        return;
    }
    let number = puzzles[0].number;
    let games = puzzles.len();

    // All at once, not one after another: the calls are independent, and awaiting each in turn
    // puts the day's puzzle on the last subnet several seconds' worth of round trips after the
    // first, with one stopped index holding up every index behind it.
    let futures: Vec<_> = targets
        .into_iter()
        .map(|canister_id| {
            let args = c2c_daily_puzzle_push::Args {
                puzzles: puzzles.clone(),
            };
            async move {
                (
                    canister_id,
                    local_user_index_canister_c2c_client::c2c_daily_puzzle_push(canister_id, &args).await,
                )
            }
        })
        .collect();

    let responses = futures::future::join_all(futures).await;
    let stale = GENERATION.get() != generation;
    for (canister_id, response) in responses {
        if settled(&response) && !stale {
            mutate_state(|state| state.data.pending_pushes.remove(&canister_id));
        }
        match response {
            Ok(UnitResult::Success) => info!(%canister_id, number, games, "Pushed puzzles"),
            // The index refused it, which its guard does while it has not yet been told this
            // canister's id. It pulls for itself the moment it is, so there is nothing to retry.
            Ok(UnitResult::Error(error)) => info!(%canister_id, ?error, "Local user index declined puzzles"),
            Err(error) if settled(&Err(error.clone())) => {
                error!(%canister_id, ?error, "Failed to push puzzles, not retrying")
            }
            Err(error) => info!(%canister_id, ?error, "Failed to push puzzles, will retry"),
        }
    }

    let pending = read_state(|state| state.data.pending_pushes.len());
    match after_run(stale, pending, ATTEMPTS.get()) {
        // A newer run owns the set now and schedules its own retries
        None => {}
        Some(After::Done) => ATTEMPTS.set(0),
        Some(After::GiveUp) => {
            let pending: Vec<_> = read_state(|state| state.data.pending_pushes.iter().copied().collect());
            error!(
                ?pending,
                number, "Giving up pushing puzzles; these indexes will pull for themselves"
            );
            mutate_state(|state| state.data.pending_pushes.clear());
            ATTEMPTS.set(0);
        }
        Some(After::Retry(delay)) => {
            ATTEMPTS.set(ATTEMPTS.get() + 1);
            schedule(false, delay);
        }
    }
}

// Whether a response leaves the index owed nothing more from this run. A success, a refusal, and
// a failure no retry would change all settle it; only a transient failure keeps it pending.
fn settled(response: &Result<UnitResult, C2CError>) -> bool {
    match response {
        Ok(_) => true,
        Err(error) => delay_if_should_retry_failed_c2c_call(error).is_none(),
    }
}

#[derive(Debug, PartialEq, Eq)]
enum After {
    Done,
    Retry(Duration),
    GiveUp,
}

// What a run does once its responses are in. `None` when a newer run has rebuilt the pending set
// since this one started: its successes would otherwise remove entries the newer run still owes,
// and the newer run's failure to the same index would then never be retried.
fn after_run(stale: bool, pending: usize, previous_attempts: u32) -> Option<After> {
    if stale {
        return None;
    }
    if pending == 0 {
        return Some(After::Done);
    }
    let attempt = previous_attempts + 1;
    if attempt > MAX_ATTEMPTS {
        return Some(After::GiveUp);
    }
    Some(After::Retry(retry_delay(attempt)))
}

#[cfg(test)]
mod tests {
    use super::*;

    // #9332 invariant 35. A push backs off, gives up after a bounded number of attempts, and a
    // run whose responses arrive after a newer run has rebuilt the pending set leaves it alone.
    #[test]
    fn retries_back_off_then_give_up_and_a_stale_run_touches_nothing() {
        assert_eq!(after_run(false, 0, 0), Some(After::Done));
        assert_eq!(after_run(false, 0, 5), Some(After::Done));
        for previous in 0..MAX_ATTEMPTS {
            assert_eq!(
                after_run(false, 3, previous),
                Some(After::Retry(retry_delay(previous + 1))),
                "{previous}"
            );
        }
        assert_eq!(after_run(false, 3, MAX_ATTEMPTS), Some(After::GiveUp));
        for previous in [0, 3, MAX_ATTEMPTS, MAX_ATTEMPTS + 5] {
            assert_eq!(after_run(true, 3, previous), None);
            assert_eq!(after_run(true, 0, previous), None);
        }
    }

    #[test]
    fn only_a_transient_failure_stays_pending() {
        use candid::Principal;
        use ic_cdk::call::RejectCode;
        use types::C2CRetryPolicy;
        let failed = |policy| {
            Err(C2CError::new_with_retry_policy(
                Principal::anonymous(),
                "c2c_daily_puzzle_push",
                RejectCode::SysTransient,
                String::new(),
                policy,
            ))
        };
        assert!(settled(&Ok(UnitResult::Success)));
        assert!(settled(&Ok(UnitResult::Error(
            oc_error_codes::OCErrorCode::NotInitialized.into()
        ))));
        assert!(settled(&failed(C2CRetryPolicy::DoNotRetry)));
        assert!(!settled(&failed(C2CRetryPolicy::RetryImmediately)));
        assert!(!settled(&failed(C2CRetryPolicy::RetryAfterDelay)));
    }

    #[test]
    fn retry_delay_doubles_to_a_ceiling() {
        assert_eq!(retry_delay(1), Duration::from_secs(120));
        assert_eq!(retry_delay(2), Duration::from_secs(240));
        assert_eq!(retry_delay(3), Duration::from_secs(480));
        assert_eq!(retry_delay(4), MAX_RETRY_DELAY);
        assert_eq!(retry_delay(MAX_ATTEMPTS), MAX_RETRY_DELAY);
    }
}
