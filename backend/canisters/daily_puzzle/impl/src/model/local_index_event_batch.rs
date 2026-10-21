use crate::read_state;
use constants::HOUR_IN_MS;
use local_user_index_canister::DailyPuzzleEvent;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use tracing::info;
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

// A push still failing after this long is dropped. That's safe: every LocalUserIndex pulls for itself
// every 15 minutes while it holds no puzzle for the day, so a push is only ever the fast path, and
// re-sending the full set every few minutes until midnight only floods the error log.
const MAX_AGE: Milliseconds = HOUR_IN_MS;

// Batched per LocalUserIndex, with a single queue to each, as its idempotency check keeps one
// high-water mark per sender. Each event carries a full day's set, so batches are small.
grouped_timer_job_batch!(LocalIndexEventBatch, CanisterId, IdempotentEnvelope<DailyPuzzleEvent>, 10);

impl TimerJobItem for LocalIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = local_user_index_canister_c2c_client::c2c_daily_puzzle(
            self.key,
            &local_user_index_canister::c2c_daily_puzzle::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let oldest = self.items.first().map(|e| e.created_at).unwrap_or_default();
                let age = read_state(|state| state.env.now()).saturating_sub(oldest);
                let delay = retry_delay(&error, age);
                if delay.is_none() {
                    info!(canister_id = %self.key, ?error, "Dropped puzzles; the index will pull for itself");
                }
                Err(delay)
            }
        }
    }
}

// The delay before retrying a failed batch, given how long ago its oldest event was made, or `None` if
// it is to be dropped. An index which refuses the call, as its guard does until it has been told this
// canister's id, pulls for itself the moment it is, so a refusal isn't retried either.
fn retry_delay(error: &C2CError, age: Milliseconds) -> Option<Milliseconds> {
    if age > MAX_AGE {
        None
    } else {
        // An index not yet upgraded to take these is retried until it has been
        delay_if_should_retry_failed_c2c_call_to_new_method(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_cdk::call::RejectCode;
    use types::C2CRetryPolicy;

    fn error(retry_policy: C2CRetryPolicy) -> C2CError {
        C2CError::new_with_retry_policy(
            Principal::anonymous(),
            "c2c_daily_puzzle",
            RejectCode::SysTransient,
            String::new(),
            retry_policy,
        )
    }

    #[test]
    fn a_transient_failure_is_retried_for_an_hour() {
        let error = error(C2CRetryPolicy::RetryImmediately);
        assert_eq!(retry_delay(&error, 0), Some(0));
        assert_eq!(retry_delay(&error, MAX_AGE), Some(0));
        assert_eq!(retry_delay(&error, MAX_AGE + 1), None);
    }

    #[test]
    fn a_refusal_is_not_retried() {
        assert_eq!(retry_delay(&error(C2CRetryPolicy::DoNotRetry), 0), None);
    }
}
