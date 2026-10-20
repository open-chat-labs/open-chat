use crate::read_state;
use constants::DAY_IN_MS;
use escrow_canister::{EscrowEvent, c2c_escrow};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use tracing::info;
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::{delay_if_should_retry_failed_c2c_call_to_new_method, is_target_canister_uninstalled_or_deleted};

// A notification still failing after this long is dropped: the canister is stopped for good, or out of
// cycles, and the swap's state can always be read from this canister
const MAX_AGE: Milliseconds = 7 * DAY_IN_MS;

// Batched per canister notified. Each canister has a single queue here, as its idempotency check keeps
// one high-water mark per sender.
grouped_timer_job_batch!(EscrowEventBatch, CanisterId, IdempotentEnvelope<EscrowEvent>, 100);

impl TimerJobItem for EscrowEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = c2c_escrow(
            self.key,
            &c2c_escrow::Args {
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
                    info!(canister_id = %self.key, events = self.items.len(), ?error, "Dropped swap status change notifications");
                }
                Err(delay)
            }
        }
    }
}

// The delay before retrying a failed batch, given how long ago its oldest event was made, or `None` if it
// is to be dropped
fn retry_delay(error: &C2CError, age: Milliseconds) -> Option<Milliseconds> {
    // An uninstalled canister fails the call with a `CanisterError`, which would otherwise be retried,
    // but the canister won't be reinstalled, eg. a deleted group or community, or a migrated user's old
    // User canister
    if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) || age > MAX_AGE {
        None
    } else {
        // A receiver not yet upgraded to take these is retried until it has been
        delay_if_should_retry_failed_c2c_call_to_new_method(error)
    }
}

// The canister notified is a Group, Community or MultiUser canister, whichever the swap names, so the
// call is made by method name with args defined in `escrow_canister`
canister_client::generate_c2c_call!(c2c_escrow, 300);

#[cfg(test)]
mod tests {
    use super::*;
    use ic_cdk::call::RejectCode;
    use types::C2CRetryPolicy;

    fn error(reject_code: RejectCode, message: &str, retry_policy: C2CRetryPolicy) -> C2CError {
        C2CError::new_with_retry_policy(
            CanisterId::anonymous(),
            "c2c_escrow",
            reject_code,
            message.to_string(),
            retry_policy,
        )
    }

    #[test]
    fn notifications_to_an_uninstalled_or_deleted_canister_are_dropped() {
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
    fn notifications_are_dropped_after_a_week() {
        let error = error(RejectCode::SysTransient, "", C2CRetryPolicy::RetryImmediately);

        assert_eq!(retry_delay(&error, MAX_AGE), Some(0));
        assert_eq!(retry_delay(&error, MAX_AGE + 1), None);
    }
}
