// For payments which failed, whether to call into their ledger (eg. because it is stopped, traps or is
// out of cycles) or with an error from it (eg. `TemporarilyUnavailable`). Rather than being retried
// round after round, which burns the payer's cycles for as long as the ledger keeps failing, they are
// retried after a delay which grows with each failure.
use crate::canister::{delay_if_should_retry_failed_c2c_call, is_target_canister_uninstalled_or_deleted};
use constants::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, SECOND_IN_MS};
use types::{C2CError, Milliseconds, TimestampMillis};

// The shortest delay before retrying a payment, so that a ledger which fails in a way that calls for
// an immediate retry isn't called round after round
pub const MIN_RETRY_DELAY: Milliseconds = 10 * SECOND_IN_MS;
// The longest delay before retrying a payment, so that it is made within an hour of its ledger
// recovering
pub const MAX_RETRY_DELAY: Milliseconds = HOUR_IN_MS;
// Ledgers reject a transfer whose `created_at_time` is more than 24 hours old. A retry which would
// fall after then is brought forward to this long before, so that a ledger which recovers in the
// meantime is still paid, as it would have been were the payment retried every round.
pub const FINAL_RETRY_BEFORE_TOO_OLD: Milliseconds = 5 * MINUTE_IN_MS;

// Returns the delay before retrying a payment, given the number of attempts at it which have failed
// to call into its ledger, or `None` if it is to be parked
pub fn retry_delay(error: &C2CError, failures: u32) -> Option<Milliseconds> {
    // A ledger which has been deleted won't come back, and one which has been uninstalled has lost
    // its balances, so the payment can't be made
    if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) {
        None
    } else {
        // Funds are at stake, so a payment is never given up on, even after a failure which calls
        // for no retry, in case the ledger is fixed
        let delay = delay_if_should_retry_failed_c2c_call(error).unwrap_or(MAX_RETRY_DELAY);
        Some(backoff(delay, failures))
    }
}

// Returns `delay`, but at least `MIN_RETRY_DELAY`, doubled for each of the payment's failures after the
// first, up to `MAX_RETRY_DELAY`
pub fn backoff(delay: Milliseconds, failures: u32) -> Milliseconds {
    let multiplier = 2u64.saturating_pow(failures.saturating_sub(1));
    delay.max(MIN_RETRY_DELAY).saturating_mul(multiplier).min(MAX_RETRY_DELAY)
}

// Returns when a payment whose transfer has a `created_at_time` of `created_at` is last retried
// before its ledger would reject it as too old
pub fn final_retry(created_at: TimestampMillis) -> TimestampMillis {
    (created_at + DAY_IN_MS).saturating_sub(FINAL_RETRY_BEFORE_TOO_OLD)
}

// Returns when to retry a payment whose transfer has a `created_at_time` of `created_at`, after a
// failure which calls for `delay`. Only needed where a payment keeps its `created_at_time` across
// attempts.
pub fn retry_due(created_at: TimestampMillis, delay: Milliseconds, now: TimestampMillis) -> TimestampMillis {
    let final_retry = final_retry(created_at);
    let due = now + delay;
    if now < final_retry { due.min(final_retry) } else { due }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_cdk::call::RejectCode;
    use types::{C2CRetryPolicy, CanisterId};

    fn error(reject_code: RejectCode, message: &str, retry_policy: C2CRetryPolicy) -> C2CError {
        C2CError::new_with_retry_policy(
            CanisterId::anonymous(),
            "icrc1_transfer",
            reject_code,
            message.to_string(),
            retry_policy,
        )
    }

    #[test]
    fn payment_to_uninstalled_or_deleted_ledger_is_parked() {
        let uninstalled = error(
            RejectCode::CanisterError,
            "...contains no Wasm module.",
            C2CRetryPolicy::RetryAfterDelay,
        );
        let deleted = error(RejectCode::DestinationInvalid, "", C2CRetryPolicy::DoNotRetry);

        assert_eq!(retry_delay(&uninstalled, 1), None);
        assert_eq!(retry_delay(&deleted, 1), None);
    }

    #[test]
    fn retry_delay_doubles_with_each_failure_up_to_the_max() {
        let stopped = error(
            RejectCode::CanisterError,
            "Canister x is stopped",
            C2CRetryPolicy::RetryAfterShortDelay,
        );
        let trapped = error(RejectCode::CanisterError, "Canister trapped", C2CRetryPolicy::RetryAfterDelay);

        assert_eq!(retry_delay(&stopped, 1), Some(10 * SECOND_IN_MS));
        assert_eq!(retry_delay(&stopped, 2), Some(20 * SECOND_IN_MS));
        assert_eq!(retry_delay(&stopped, 9), Some(2560 * SECOND_IN_MS));
        assert_eq!(retry_delay(&stopped, 10), Some(MAX_RETRY_DELAY));
        assert_eq!(retry_delay(&stopped, u32::MAX), Some(MAX_RETRY_DELAY));
        assert_eq!(retry_delay(&trapped, 1), Some(5 * MINUTE_IN_MS));
        assert_eq!(retry_delay(&trapped, 4), Some(40 * MINUTE_IN_MS));
        assert_eq!(retry_delay(&trapped, 5), Some(MAX_RETRY_DELAY));
    }

    #[test]
    fn failure_calling_for_no_retry_is_retried_after_the_max_delay() {
        let error = error(RejectCode::CanisterReject, "", C2CRetryPolicy::DoNotRetry);

        assert_eq!(retry_delay(&error, 1), Some(MAX_RETRY_DELAY));
    }

    #[test]
    fn retry_which_would_be_too_old_for_the_ledger_is_brought_forward() {
        let created_at = 1_000 * DAY_IN_MS;
        let final_retry = created_at + DAY_IN_MS - FINAL_RETRY_BEFORE_TOO_OLD;

        assert_eq!(
            retry_due(created_at, HOUR_IN_MS, created_at + HOUR_IN_MS),
            created_at + 2 * HOUR_IN_MS
        );
        assert_eq!(retry_due(created_at, HOUR_IN_MS, final_retry - MINUTE_IN_MS), final_retry);
        // Once the final retry has failed, the payment is retried after the usual delay
        assert_eq!(retry_due(created_at, HOUR_IN_MS, final_retry), final_retry + HOUR_IN_MS);
    }
}
