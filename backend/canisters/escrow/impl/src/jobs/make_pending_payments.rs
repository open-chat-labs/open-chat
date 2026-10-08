use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::timer_job_types::{RetryPaymentJob, TimerJob};
use crate::{RuntimeState, mutate_state, read_state};
use constants::NANOS_PER_MILLISECOND;
use escrow_canister::{SwapStatus, deposit_subaccount};
use ic_cdk::call::RejectCode;
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use ledger_utils::icrc1::make_transfer;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::icrc1::{Account, CompletedCryptoTransaction};
use types::{C2CError, C2CRetryPolicy, Milliseconds, TimestampMillis};
use utils::canister::is_target_canister_uninstalled_or_deleted;
use utils::payment_retries::{MIN_RETRY_DELAY, backoff, final_retry, retry_delay, retry_due};

// The number of a payment's failed attempts which are recorded in its swap's errors
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
        utils::async_work::spawn_tracked(process_payment(pending_payment, 0, false));
        read_state(start_job_if_required);
    }
}

// Called once a payment whose last attempt failed is due to be retried
pub(crate) fn retry(pending_payment: PendingPayment, failures: u32, outcome_unknown: bool) {
    // Clears out the entry which the retry's timer job has left behind, along with any others, whatever
    // the outcome of the retry
    mutate_state(|state| state.data.timer_jobs.remove_completed_jobs());
    utils::async_work::spawn_tracked(process_payment(pending_payment, failures, outcome_unknown));
}

// `previous_failures` is the number of earlier attempts at the payment which failed, and
// `outcome_unknown` is whether any of them may have made the transfer nonetheless
async fn process_payment(mut pending_payment: PendingPayment, previous_failures: u32, outcome_unknown: bool) {
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

    mutate_state(|state| {
        let now = state.env.now();
        let ledger = pending_payment.token_info.ledger;
        let failures = previous_failures.saturating_add(1);
        let outcome_unknown = outcome_unknown || matches!(&response, Err(error) if may_have_made_transfer(error));

        match next_step(&response, &pending_payment, failures, outcome_unknown, now) {
            NextStep::Record(block_index) => {
                if let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id) {
                    if pending_payment.holds_deposit_lock {
                        swap.locked_deposits.remove(&pending_payment.principal);
                    }

                    // A refund can be queued twice (eg. by two `notify_deposit` calls at once), in which
                    // case the ledger reports the second as a duplicate of the first, which is already
                    // recorded
                    if swap.is_payment_recorded(ledger, block_index) {
                        return;
                    }

                    let transfer = CompletedCryptoTransaction {
                        ledger,
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
                            if ledger == swap.token0.ledger {
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
            NextStep::Retry { delay, remake, error } => {
                // Only the first few failures are recorded, so that a ledger which keeps failing doesn't
                // grow the swap's errors without bound
                if failures <= MAX_FAILURES_RECORDED
                    && let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id)
                {
                    swap.errors.push(error);
                }

                if remake {
                    info!(
                        swap_id = pending_payment.swap_id,
                        %ledger,
                        created_at = pending_payment.timestamp,
                        "Remaking payment which its ledger rejected as too old"
                    );
                    // Created as of when it will be sent, so that a ledger whose transaction window is
                    // shorter than the delay doesn't reject it as too old again
                    pending_payment.timestamp = now + delay;
                }

                let due = retry_due(pending_payment.timestamp, delay, now);
                state.data.timer_jobs.enqueue_job(
                    TimerJob::RetryPayment(Box::new(RetryPaymentJob {
                        payment: pending_payment,
                        failures,
                        outcome_unknown,
                    })),
                    due,
                    now,
                );
            }
            NextStep::Park { error } => {
                error!(swap_id = pending_payment.swap_id, %ledger, error, "Parked payment");
                // A parked refund keeps its deposit locked, as it may yet be made by hand
                if let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id) {
                    swap.errors.push(error);
                }
                state.data.pending_payments_queue.park(pending_payment);
            }
            NextStep::Drop { error } => {
                error!(?args, error, "Failed to process payment");
                if let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id) {
                    swap.errors.push(error);
                    if pending_payment.holds_deposit_lock {
                        swap.locked_deposits.remove(&pending_payment.principal);
                    }
                }
            }
        }
    });
}

// What to do with a payment after an attempt at it
#[derive(Debug, PartialEq, Eq)]
enum NextStep {
    // Record the payment as made, in this block
    Record(u64),
    // Retry the payment after this delay, first remaking it with a fresh `created_at_time` if `remake`
    Retry {
        delay: Milliseconds,
        remake: bool,
        error: String,
    },
    // Keep the payment, but don't retry it, so that it can be dealt with by hand
    Park {
        error: String,
    },
    // Give up on the payment
    Drop {
        error: String,
    },
}

// `failures` counts this attempt, should it have failed, and `outcome_unknown` is whether this or any
// earlier attempt may have made the transfer despite failing
fn next_step(
    response: &Result<Result<u64, TransferError>, C2CError>,
    payment: &PendingPayment,
    failures: u32,
    outcome_unknown: bool,
    now: TimestampMillis,
) -> NextStep {
    match response {
        Ok(Ok(block_index)) => NextStep::Record(*block_index),
        Err(error) => match retry_delay(error, failures) {
            Some(delay) => NextStep::Retry {
                delay,
                remake: false,
                error: format!("Failed to call into ledger: {error:?}"),
            },
            None => NextStep::Park {
                error: format!(
                    "Failed to call into ledger, so parked the payment as the ledger is uninstalled or deleted: {error:?}"
                ),
            },
        },
        Ok(Err(error)) => {
            let message = |outcome: &str| format!("Ledger returned an error{outcome}: {error:?}");
            match error {
                // An earlier attempt went through, but its response was lost or couldn't be decoded
                TransferError::Duplicate { duplicate_of } => u64::try_from(&duplicate_of.0).map_or_else(
                    |_| NextStep::Park {
                        error: message(", so parked the payment"),
                    },
                    NextStep::Record,
                ),
                // The ledger can make the payment once it is available again, or its clock has caught
                // up with ours
                TransferError::TemporarilyUnavailable | TransferError::CreatedInFuture { .. } => NextStep::Retry {
                    delay: backoff(MIN_RETRY_DELAY, failures),
                    remake: false,
                    error: message(""),
                },
                // Remaking the payment would pay it twice if an earlier attempt went through and the
                // deposit holds enough for another, eg. after an overpayment
                TransferError::TooOld if outcome_unknown => NextStep::Park {
                    error: message(", so parked the payment as an earlier attempt at it may have gone through"),
                },
                // Each earlier attempt is known to have failed, so the payment was never made and can be
                // remade. That happens straight away if it really is too old, its ledger having been
                // unavailable since its final retry, but otherwise after the usual delay, so that a
                // ledger which wrongly rejects payments as too old can't have one remade round after
                // round.
                TransferError::TooOld => NextStep::Retry {
                    delay: if now >= final_retry(payment.timestamp) { 0 } else { backoff(MIN_RETRY_DELAY, failures) },
                    remake: true,
                    error: message(", so remade the payment"),
                },
                // A deposit's refund can be queued twice (eg. by two `notify_deposit` calls at once, or
                // one racing the swap's expiry), in which case whichever is made second fails, there
                // being nothing left to refund. Nothing is lost by dropping a refund, since it is of the
                // recipient's own deposit, whatever is left of which they can have refunded by
                // notifying it again.
                TransferError::InsufficientFunds { .. } if matches!(payment.reason, PendingPaymentReason::Refund) => {
                    NextStep::Drop { error: message("") }
                }
                _ => NextStep::Park {
                    error: message(", so parked the payment"),
                },
            }
        }
    }
}

// Whether a failed call into a ledger may have made the transfer nonetheless, which only failures
// showing that the ledger never ran the call rule out. Ledgers commit a transfer before awaiting the
// archiving of their blocks, so a trap after that await comes from a transfer which was made, as can
// a response which couldn't be decoded (a `CanisterError` too, see `canister_client::make_c2c_call`)
// or one which was lost (`SysUnknown`).
fn may_have_made_transfer(error: &C2CError) -> bool {
    let never_ran = match error.reject_code() {
        // The call couldn't be made, or the ledger couldn't take it, eg. as it is out of cycles
        RejectCode::SysTransient | RejectCode::DestinationInvalid => true,
        // The ledger is stopped (the only failure given `RetryAfterShortDelay`, see
        // `C2CRetryPolicy::from_cdk_error`), has no Wasm module, or has no such method
        RejectCode::CanisterError => {
            error.retry_policy() == C2CRetryPolicy::RetryAfterShortDelay
                || is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message())
                || error.is_method_not_found()
        }
        _ => false,
    };
    !never_ran
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::{Nat, Principal};
    use constants::{DAY_IN_MS, HOUR_IN_MS};
    use types::{CanisterId, TokenInfo};
    use utils::payment_retries::{FINAL_RETRY_BEFORE_TOO_OLD, MAX_RETRY_DELAY};

    const NOW: TimestampMillis = 1_000 * DAY_IN_MS;

    fn error(reject_code: RejectCode, message: &str, retry_policy: C2CRetryPolicy) -> C2CError {
        C2CError::new_with_retry_policy(
            CanisterId::anonymous(),
            "icrc1_transfer",
            reject_code,
            message.to_string(),
            retry_policy,
        )
    }

    fn payment(reason: PendingPaymentReason, timestamp: TimestampMillis) -> PendingPayment {
        PendingPayment {
            principal: Principal::from_slice(&[1]),
            timestamp,
            token_info: TokenInfo {
                symbol: "TEST".to_string(),
                ledger: CanisterId::from_slice(&[2]),
                decimals: 8,
                fee: 10_000,
            },
            amount: 1_000_000,
            swap_id: 0,
            reason,
            holds_deposit_lock: false,
        }
    }

    fn refund(timestamp: TimestampMillis) -> PendingPayment {
        payment(PendingPaymentReason::Refund, timestamp)
    }

    // The next step after the ledger returns `error` for an attempt at `payment`, with no earlier
    // attempt's outcome unknown
    fn after_ledger_error(error: TransferError, payment: &PendingPayment, failures: u32) -> NextStep {
        next_step(&Ok(Err(error)), payment, failures, false, NOW)
    }

    fn is_parked(step: &NextStep) -> bool {
        matches!(step, NextStep::Park { error } if error.starts_with("Ledger returned an error, so parked the payment"))
    }

    #[test]
    fn duplicate_is_recorded_as_made_in_the_earlier_block() {
        let step = after_ledger_error(
            TransferError::Duplicate {
                duplicate_of: Nat::from(5u32),
            },
            &refund(NOW),
            1,
        );

        assert_eq!(step, NextStep::Record(5));
    }

    #[test]
    fn ledger_temporarily_unavailable_or_behind_is_retried_with_backoff() {
        let errors = [
            TransferError::TemporarilyUnavailable,
            TransferError::CreatedInFuture { ledger_time: NOW - 1 },
        ];

        for error in errors {
            for (failures, delay) in [(1, MIN_RETRY_DELAY), (20, MAX_RETRY_DELAY)] {
                let step = after_ledger_error(error.clone(), &refund(NOW), failures);

                assert_eq!(
                    step,
                    NextStep::Retry {
                        delay,
                        remake: false,
                        error: format!("Ledger returned an error: {error:?}"),
                    }
                );
            }
        }
    }

    #[test]
    fn payment_rejected_as_too_old_is_remade_straight_away_once_past_its_final_retry() {
        let created_at = NOW - DAY_IN_MS - HOUR_IN_MS;

        let step = after_ledger_error(TransferError::TooOld, &refund(created_at), 30);

        assert_eq!(
            step,
            NextStep::Retry {
                delay: 0,
                remake: true,
                error: "Ledger returned an error, so remade the payment: TooOld".to_string(),
            }
        );
        // Created so that its final retry is due now
        let created_at = NOW - DAY_IN_MS + FINAL_RETRY_BEFORE_TOO_OLD;
        assert!(matches!(
            after_ledger_error(TransferError::TooOld, &refund(created_at), 30),
            NextStep::Retry { delay: 0, .. }
        ));
    }

    // A ledger which rejects a payment as too old before it can be, eg. one which is malicious, has it
    // remade after the usual delay, so it can't have it remade round after round
    #[test]
    fn payment_wrongly_rejected_as_too_old_is_remade_after_the_usual_delay() {
        // Created just now, and just too recently for its final retry to be due
        for created_at in [NOW, NOW - DAY_IN_MS + FINAL_RETRY_BEFORE_TOO_OLD + 1] {
            let step = after_ledger_error(TransferError::TooOld, &refund(created_at), 2);

            assert!(
                matches!(step, NextStep::Retry { delay, remake: true, .. } if delay == 2 * MIN_RETRY_DELAY),
                "{step:?}"
            );
        }
    }

    #[test]
    fn payment_rejected_as_too_old_after_an_attempt_with_an_unknown_outcome_is_parked() {
        let created_at = NOW - DAY_IN_MS - HOUR_IN_MS;

        let step = next_step(&Ok(Err(TransferError::TooOld)), &refund(created_at), 30, true, NOW);

        assert_eq!(
            step,
            NextStep::Park {
                error:
                    "Ledger returned an error, so parked the payment as an earlier attempt at it may have gone through: TooOld"
                        .to_string(),
            }
        );
    }

    #[test]
    fn refund_with_insufficient_funds_is_dropped() {
        let error = TransferError::InsufficientFunds {
            balance: Nat::from(0u32),
        };

        assert_eq!(
            after_ledger_error(error.clone(), &refund(NOW), 1),
            NextStep::Drop {
                error: format!("Ledger returned an error: {error:?}"),
            }
        );
    }

    // A swap's payout always comes from a deposit which was recorded and is held for it
    #[test]
    fn payout_with_insufficient_funds_is_parked() {
        let payout = payment(PendingPaymentReason::Swap(Principal::from_slice(&[3])), NOW);
        let error = TransferError::InsufficientFunds {
            balance: Nat::from(0u32),
        };

        assert!(is_parked(&after_ledger_error(error, &payout, 1)));
    }

    #[test]
    fn other_ledger_errors_park_the_payment() {
        let errors = [
            TransferError::BadFee {
                expected_fee: Nat::from(20_000u32),
            },
            TransferError::BadBurn {
                min_burn_amount: Nat::from(1u32),
            },
            TransferError::GenericError {
                error_code: Nat::from(1u32),
                message: "error".to_string(),
            },
        ];

        for error in errors {
            let step = after_ledger_error(error, &refund(NOW), 1);
            assert!(is_parked(&step), "{step:?}");
        }
    }

    #[test]
    fn failed_call_which_may_have_made_the_transfer_leaves_its_outcome_unknown() {
        let lost = error(RejectCode::SysUnknown, "", C2CRetryPolicy::RetryImmediately);
        // As `canister_client::make_c2c_call` reports a response it can't decode
        let undecodable = error(
            RejectCode::CanisterError,
            "Deserialization error: ...",
            C2CRetryPolicy::DoNotRetry,
        );
        let trapped = error(RejectCode::CanisterError, "Canister trapped", C2CRetryPolicy::RetryAfterDelay);
        let rejected = error(RejectCode::CanisterReject, "", C2CRetryPolicy::DoNotRetry);

        for error in [lost, undecodable, trapped, rejected] {
            assert!(may_have_made_transfer(&error), "{error:?}");
        }
    }

    #[test]
    fn failed_call_which_the_ledger_never_ran_leaves_its_outcome_known() {
        let out_of_cycles = error(RejectCode::SysTransient, "", C2CRetryPolicy::RetryAfterDelay);
        let deleted = error(RejectCode::DestinationInvalid, "", C2CRetryPolicy::DoNotRetry);
        let stopped = error(
            RejectCode::CanisterError,
            "Canister x is stopped",
            C2CRetryPolicy::RetryAfterShortDelay,
        );
        let uninstalled = error(
            RejectCode::CanisterError,
            "...contains no Wasm module.",
            C2CRetryPolicy::RetryAfterDelay,
        );
        let no_such_method = error(
            RejectCode::CanisterError,
            "Canister has no update method 'icrc1_transfer'",
            C2CRetryPolicy::DoNotRetry,
        );

        for error in [out_of_cycles, deleted, stopped, uninstalled, no_such_method] {
            assert!(!may_have_made_transfer(&error), "{error:?}");
        }
    }

    #[test]
    fn failed_call_into_ledger_is_retried_or_parked() {
        let stopped = error(
            RejectCode::CanisterError,
            "Canister x is stopped",
            C2CRetryPolicy::RetryAfterShortDelay,
        );
        let deleted = error(RejectCode::DestinationInvalid, "", C2CRetryPolicy::DoNotRetry);

        assert!(matches!(
            next_step(&Err(stopped), &refund(NOW), 1, false, NOW),
            NextStep::Retry { delay: MIN_RETRY_DELAY, remake: false, error } if error.starts_with("Failed to call into ledger: ")
        ));
        assert!(matches!(
            next_step(&Err(deleted), &refund(NOW), 1, false, NOW),
            NextStep::Park { error } if error.starts_with("Failed to call into ledger, so parked the payment")
        ));
    }
}
