use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::timer_job_types::{RetryPaymentJob, TimerJob};
use crate::{RuntimeState, mutate_state, read_state};
use constants::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, NANOS_PER_MILLISECOND, SECOND_IN_MS};
use escrow_canister::{SwapStatus, deposit_subaccount};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use ledger_utils::icrc1::make_transfer;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::icrc1::{Account, CompletedCryptoTransaction};
use types::{C2CError, Milliseconds, TimestampMillis};
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_target_canister_uninstalled_or_deleted};

// The shortest delay before retrying a payment whose ledger couldn't be called, so that a ledger
// which fails in a way that calls for an immediate retry isn't called round after round
const MIN_RETRY_DELAY: Milliseconds = 10 * SECOND_IN_MS;
// The longest delay before retrying a payment, so that it is made within an hour of its ledger
// recovering
const MAX_RETRY_DELAY: Milliseconds = HOUR_IN_MS;
// Ledgers reject a transfer whose `created_at_time` is more than 24 hours old. A retry which would
// fall after then is brought forward to this long before, so that a ledger which recovers in the
// meantime is still paid, as it would have been were the payment retried every round.
const FINAL_RETRY_BEFORE_TOO_OLD: Milliseconds = 5 * MINUTE_IN_MS;
// The number of a payment's failed calls into its ledger which are recorded in its swap's errors
const MAX_FAILURES_RECORDED: u32 = 3;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_payments_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'make_pending_payments' job running");
    TIMER_ID.set(None);

    if let Some(pending_payment) = mutate_state(|state| state.data.pending_payments_queue.pop()) {
        utils::async_work::spawn_tracked(process_payment(pending_payment, 0));
        read_state(start_job_if_required);
    }
}

// Called once a payment whose ledger couldn't be called is due to be retried
pub(crate) fn retry(pending_payment: PendingPayment, failures: u32) {
    utils::async_work::spawn_tracked(process_payment(pending_payment, failures));
}

// `previous_failures` is the number of earlier attempts at the payment which failed to call into
// its ledger
async fn process_payment(pending_payment: PendingPayment, previous_failures: u32) {
    let from_principal = match pending_payment.reason {
        PendingPaymentReason::Swap(other_principal) => other_principal,
        PendingPaymentReason::Refund => pending_payment.principal,
    };
    let created_at_time = pending_payment.timestamp * NANOS_PER_MILLISECOND;

    let args = TransferArg {
        from_subaccount: Some(deposit_subaccount(from_principal, pending_payment.swap_id)),
        to: pending_payment.principal.into(),
        fee: Some(pending_payment.token_info.fee.into()),
        created_at_time: Some(created_at_time),
        memo: None,
        amount: pending_payment.amount.into(),
    };

    let response = make_transfer(pending_payment.token_info.ledger, &args, true).await;

    mutate_state(|state| match response {
        Ok(Ok(block_index)) => {
            if let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id) {
                let transfer = CompletedCryptoTransaction {
                    ledger: pending_payment.token_info.ledger,
                    token_symbol: pending_payment.token_info.symbol,
                    amount: pending_payment.amount,
                    from: Account {
                        owner: state.env.canister_id(),
                        subaccount: args.from_subaccount,
                    }
                    .into(),
                    to: Account::from(pending_payment.principal).into(),
                    fee: pending_payment.token_info.fee,
                    memo: None,
                    created: created_at_time,
                    block_index,
                };
                let notify_status_change = match pending_payment.reason {
                    PendingPaymentReason::Swap(_) => {
                        if pending_payment.token_info.ledger == swap.token0.ledger {
                            swap.token0_transfer_out = Some(transfer);
                        } else {
                            swap.token1_transfer_out = Some(transfer);
                        }
                        swap.is_complete()
                    }
                    PendingPaymentReason::Refund => {
                        swap.refunds.push(transfer);
                        matches!(
                            swap.status(state.env.now()),
                            SwapStatus::Expired(_) | SwapStatus::Cancelled(_)
                        )
                    }
                };

                if notify_status_change {
                    state.data.notify_status_change_queue.push(swap.id);
                    crate::jobs::notify_status_change::start_job_if_required(state);
                }
            }
        }
        Ok(Err(error)) => {
            error!(?error, ?args, "Failed to process payment");
            if let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id) {
                swap.errors.push(format!("Ledger returned an error: {error:?}"));
            }
        }
        Err(error) => {
            let failures = previous_failures.saturating_add(1);
            let delay = retry_delay(&error, failures);

            // Only the first few failures are recorded, so that a ledger which keeps failing doesn't
            // grow the swap's errors without bound, but a payment being parked always is
            if (failures <= MAX_FAILURES_RECORDED || delay.is_none())
                && let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id)
            {
                swap.errors.push(match delay {
                    Some(_) => format!("Failed to call into ledger: {error:?}"),
                    None => format!(
                        "Failed to call into ledger, so parked the payment as the ledger is uninstalled or deleted: {error:?}"
                    ),
                });
            }

            match delay {
                Some(delay) => {
                    let now = state.env.now();
                    let due = retry_due(pending_payment.timestamp, delay, now);
                    state.data.timer_jobs.remove_completed_jobs();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::RetryPayment(Box::new(RetryPaymentJob {
                            payment: pending_payment,
                            failures,
                        })),
                        due,
                        now,
                    );
                }
                None => {
                    error!(
                        swap_id = pending_payment.swap_id,
                        ledger = %pending_payment.token_info.ledger,
                        ?error,
                        "Parked payment, as its ledger is uninstalled or deleted"
                    );
                    state.data.pending_payments_queue.park(pending_payment);
                }
            }
        }
    });
}

// Returns the delay before retrying a payment, given the number of attempts at it which have failed
// to call into its ledger, or `None` if it is to be parked
fn retry_delay(error: &C2CError, failures: u32) -> Option<Milliseconds> {
    // A ledger which has been deleted won't come back, and one which has been uninstalled has lost
    // its balances, so the payment can't be made
    if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) {
        None
    } else {
        // Funds are at stake, so a payment is never given up on, even after a failure which calls
        // for no retry, in case the ledger is fixed. The delay doubles with each failure.
        let delay = delay_if_should_retry_failed_c2c_call(error)
            .unwrap_or(MAX_RETRY_DELAY)
            .max(MIN_RETRY_DELAY);
        let multiplier = 2u64.saturating_pow(failures.saturating_sub(1));
        Some(delay.saturating_mul(multiplier).min(MAX_RETRY_DELAY))
    }
}

// Returns when to retry a payment created at `created_at`, after a failure which calls for `delay`
fn retry_due(created_at: TimestampMillis, delay: Milliseconds, now: TimestampMillis) -> TimestampMillis {
    let final_retry = (created_at + DAY_IN_MS).saturating_sub(FINAL_RETRY_BEFORE_TOO_OLD);
    let due = now + delay;
    if now < final_retry { due.min(final_retry) } else { due }
}

#[cfg(test)]
mod tests {
    use super::*;
    use constants::MINUTE_IN_MS;
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
    fn failure_calling_for_an_immediate_retry_waits_the_min_delay() {
        let error = error(RejectCode::SysTransient, "", C2CRetryPolicy::RetryImmediately);

        assert_eq!(retry_delay(&error, 1), Some(MIN_RETRY_DELAY));
        assert_eq!(retry_delay(&error, 2), Some(2 * MIN_RETRY_DELAY));
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
