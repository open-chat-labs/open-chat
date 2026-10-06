use crate::model::users_to_migrate::UserToCloseOut;
use crate::{CanisterToRefund, RuntimeState, jobs, mutate_state};
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{Milliseconds, TimestampMillis};

const MAX_IN_PROGRESS: usize = 5;
const RETRY_DELAY: Milliseconds = MINUTE_IN_MS;
// Failed attempts are retried after a delay which doubles each time, up to this
const MAX_RETRY_DELAY: Milliseconds = HOUR_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Closes out the canisters of users who have been switched over to the MultiUser canister they were
// migrated to, by uninstalling them and then refunding their cycles. Any funds the canisters hold are
// dealt with off chain. Once a canister is uninstalled, whoever sends events to the user's old id
// finds they have been migrated, and sends them on to the user's new id, so a user is never dropped
// from the queue, however many times their canister fails to be uninstalled.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && let Some(next_due) = state.data.users_to_close_out.next_due(MAX_IN_PROGRESS)
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
    trace!("'close_out_migrated_users' running");
    TIMER_ID.set(None);

    let batch = mutate_state(|state| {
        let now = state.env.now();
        let batch = state.data.users_to_close_out.take_next_batch(MAX_IN_PROGRESS, now);
        // Schedule the next run for any users not yet due
        start_job_if_required(state);
        batch
    });
    for user in batch {
        utils::async_work::spawn_tracked(process_user(user));
    }
}

async fn process_user(user: UserToCloseOut) {
    let result = utils::canister::uninstall(user.user_id.canister_id()).await;

    mutate_state(|state| {
        let user_id = user.user_id;
        let now = state.env.now();
        state.data.users_to_close_out.mark_complete(&user_id);

        match result {
            Ok(()) => {
                // The canister has been uninstalled but still holds its cycles
                if state.data.local_users.remove(&user_id) {
                    state.data.cycles_refund_queue.push_back(CanisterToRefund {
                        canister_id: user_id.canister_id(),
                        attempt: 0,
                        retry_after: 0,
                        return_to_pool: false,
                    });
                    jobs::refund_cycles::start_job_if_required(state, None);
                }
                info!(%user_id, "Migrated user's canister closed out");
            }
            Err(error) => {
                let next = user_to_retry(&user, now);
                if next.attempt >= 10 {
                    error!(%user_id, attempt = next.attempt, ?error, "Failing to uninstall migrated user's canister");
                }
                state.data.users_to_close_out.push(next);
            }
        }

        start_job_if_required(state);
    });
}

fn user_to_retry(user: &UserToCloseOut, now: TimestampMillis) -> UserToCloseOut {
    let attempt = user.attempt + 1;
    let delay = RETRY_DELAY.saturating_mul(1 << attempt.min(16)).min(MAX_RETRY_DELAY);
    UserToCloseOut {
        user_id: user.user_id,
        attempt,
        not_before: now + delay,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn failed_attempt_is_retried_with_a_growing_delay_up_to_a_cap() {
        let user = UserToCloseOut {
            user_id: Principal::from_slice(&[1]).into(),
            attempt: 0,
            not_before: 0,
        };

        let first = user_to_retry(&user, 10);
        assert_eq!(first.attempt, 1);
        assert_eq!(first.not_before, 10 + 2 * RETRY_DELAY);

        let second = user_to_retry(&first, 10);
        assert_eq!(second.not_before, 10 + 4 * RETRY_DELAY);

        let later = user_to_retry(&UserToCloseOut { attempt: 100, ..user }, 10);
        assert_eq!(later.not_before, 10 + MAX_RETRY_DELAY);
    }
}
