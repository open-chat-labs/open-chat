use crate::model::swaps::Swap;
use crate::timer_job_types::{NotifyStatusChangeJob, TimerJob};
use crate::{RuntimeState, mutate_state, read_state};
use escrow_canister::SwapStatusChange;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};
use types::{C2CError, CanisterId, Milliseconds, TimestampMillis};
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_target_canister_uninstalled_or_deleted};

// The number of attempts to notify a canister of a swap's status change before giving up on it
const MAX_ATTEMPTS: u32 = 10;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.notify_status_change_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'notify_status_change' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, notification)) = mutate_state(get_next) {
        utils::async_work::spawn_tracked(notify_swap_status(canister_id, notification, 0));
        read_state(start_job_if_required);
    }
}

// Called once a failed notification is due to be retried
pub(crate) fn retry(swap_id: u32, attempt: u32) {
    if let Some((canister_id, notification)) = read_state(|state| {
        state
            .data
            .swaps
            .get(swap_id)
            .and_then(|swap| notification(swap, state.env.now()))
    }) {
        utils::async_work::spawn_tracked(notify_swap_status(canister_id, notification, attempt));
    }
}

fn get_next(state: &mut RuntimeState) -> Option<(CanisterId, SwapStatusChange)> {
    while let Some(id) = state.data.notify_status_change_queue.pop() {
        if let Some(notification) = state.data.swaps.get(id).and_then(|swap| notification(swap, state.env.now())) {
            // This sends the swap's latest status, so a pending retry of an earlier notification isn't needed
            state
                .data
                .timer_jobs
                .cancel_job(|job| matches!(job, TimerJob::NotifyStatusChange(j) if j.swap_id == id));
            return Some(notification);
        }
    }
    None
}

fn notification(swap: &Swap, now: TimestampMillis) -> Option<(CanisterId, SwapStatusChange)> {
    swap.canister_to_notify.map(|canister_id| {
        (
            canister_id,
            SwapStatusChange {
                swap_id: swap.id,
                offered_by: swap.offered_by,
                location: swap.location.clone(),
                status: swap.status(now),
            },
        )
    })
}

// `attempt` is the number of earlier attempts which have failed
async fn notify_swap_status(canister_id: CanisterId, notification: SwapStatusChange, attempt: u32) {
    let swap_id = notification.swap_id;

    if let Err(error) = c2c_notify_p2p_swap_status_change(canister_id, &notification).await {
        mutate_state(|state| {
            let now = state.env.now();
            if let Some(swap) = state.data.swaps.get_mut(swap_id) {
                swap.errors
                    .push(format!("Failed to notify {canister_id} of status change: {error:?}"));
            }

            match retry_delay(&error, attempt) {
                Some(delay) => state.data.timer_jobs.enqueue_job(
                    TimerJob::NotifyStatusChange(Box::new(NotifyStatusChangeJob {
                        swap_id,
                        attempt: attempt + 1,
                    })),
                    now + delay,
                    now,
                ),
                None => info!(swap_id, %canister_id, attempt, ?error, "Dropped swap status change notification"),
            }
        });
    }
}

// Returns the delay before retrying the failed notification, or `None` if it is to be dropped
fn retry_delay(error: &C2CError, attempt: u32) -> Option<Milliseconds> {
    // An uninstalled canister fails the call with a `CanisterError`, which would otherwise be retried,
    // but the canister won't be reinstalled, eg. its user was deleted or migrated to a MultiUser canister
    if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) || attempt + 1 >= MAX_ATTEMPTS {
        None
    } else {
        delay_if_should_retry_failed_c2c_call(error)
    }
}

canister_client::generate_c2c_call_ignore_response!(c2c_notify_p2p_swap_status_change);

mod c2c_notify_p2p_swap_status_change {
    use super::*;

    pub type Args = SwapStatusChange;
}

#[cfg(test)]
mod tests {
    use super::*;
    use constants::{MINUTE_IN_MS, SECOND_IN_MS};
    use ic_cdk::call::RejectCode;
    use types::C2CRetryPolicy;

    fn error(reject_code: RejectCode, message: &str, retry_policy: C2CRetryPolicy) -> C2CError {
        C2CError::new_with_retry_policy(
            CanisterId::anonymous(),
            "c2c_notify_p2p_swap_status_change",
            reject_code,
            message.to_string(),
            retry_policy,
        )
    }

    #[test]
    fn notification_to_uninstalled_or_deleted_canister_is_dropped() {
        let uninstalled = error(
            RejectCode::CanisterError,
            "...contains no Wasm module.",
            C2CRetryPolicy::RetryAfterDelay,
        );
        let deleted = error(RejectCode::DestinationInvalid, "", C2CRetryPolicy::DoNotRetry);

        assert_eq!(retry_delay(&uninstalled, 0), None);
        assert_eq!(retry_delay(&deleted, 0), None);
    }

    #[test]
    fn notification_is_retried_after_the_delay_the_failure_calls_for() {
        let stopped = error(
            RejectCode::CanisterError,
            "Canister x is stopped",
            C2CRetryPolicy::RetryAfterShortDelay,
        );
        let trapped = error(
            RejectCode::CanisterError,
            "Canister is frozen",
            C2CRetryPolicy::RetryAfterDelay,
        );

        assert_eq!(retry_delay(&stopped, 0), Some(10 * SECOND_IN_MS));
        assert_eq!(retry_delay(&trapped, 0), Some(5 * MINUTE_IN_MS));
    }

    #[test]
    fn notification_is_dropped_after_max_attempts() {
        let error = error(RejectCode::SysTransient, "", C2CRetryPolicy::RetryImmediately);

        assert_eq!(retry_delay(&error, MAX_ATTEMPTS - 2), Some(0));
        assert_eq!(retry_delay(&error, MAX_ATTEMPTS - 1), None);
    }
}
