use crate::model::pending_payments_queue::PendingPayment;
use crate::timer_job_types::{RetryPaymentJob, TimerJob};
use crate::{RuntimeState, mutate_state, read_state};
use constants::{MEMO_TRANSLATION_PAYMENT, NANOS_PER_MILLISECOND};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use ledger_utils::icrc1::make_transfer;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::C2CError;
use utils::payment_retries::{retry_delay, retry_due};

// The number of a payment's failed calls into its ledger which are logged
const MAX_FAILURES_LOGGED: u32 = 3;

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
    // Clears out the entry which the retry's timer job has left behind, along with any others, whatever
    // the outcome of the retry
    mutate_state(|state| state.data.timer_jobs.remove_completed_jobs());
    utils::async_work::spawn_tracked(process_payment(pending_payment, failures));
}

// `previous_failures` is the number of earlier attempts at the payment which failed to call into
// its ledger
async fn process_payment(pending_payment: PendingPayment, previous_failures: u32) {
    let args = TransferArg {
        from_subaccount: None,
        to: pending_payment.recipient_account,
        fee: Some(pending_payment.fee.into()),
        created_at_time: Some(pending_payment.timestamp * NANOS_PER_MILLISECOND),
        memo: Some(MEMO_TRANSLATION_PAYMENT.to_vec().into()),
        amount: pending_payment.amount.into(),
    };

    let result = make_transfer(pending_payment.ledger, &args, true).await;

    mutate_state(|state| {
        if let Err(error) = result {
            on_failed_to_call_ledger(pending_payment, previous_failures, error, state);
        }
        start_job_if_required(state);
    });
}

// Rather than putting the payment straight back on the queue, which would call a ledger that keeps
// failing round after round, the payment is retried after a delay which grows with each failure
fn on_failed_to_call_ledger(
    pending_payment: PendingPayment,
    previous_failures: u32,
    error: C2CError,
    state: &mut RuntimeState,
) {
    let failures = previous_failures.saturating_add(1);

    match retry_delay(&error, failures) {
        Some(delay) => {
            // Only the first few failures are logged, so that a ledger which keeps failing doesn't
            // fill the logs
            if failures <= MAX_FAILURES_LOGGED {
                error!(
                    ledger = %pending_payment.ledger,
                    failures,
                    delay,
                    ?error,
                    "Failed to call into ledger to make payment, will retry"
                );
            }
            let now = state.env.now();
            // The transfer keeps its `created_at_time` across attempts, which lets the ledger
            // deduplicate it, so it must be retried before the ledger would reject it as too old
            let due = retry_due(pending_payment.timestamp, delay, now);
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
                ledger = %pending_payment.ledger,
                ?error,
                "Parked payment, as its ledger is uninstalled or deleted"
            );
            state.data.pending_payments_queue.park(pending_payment);
        }
    }
}
