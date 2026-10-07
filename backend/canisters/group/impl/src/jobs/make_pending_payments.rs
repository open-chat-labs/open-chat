use crate::timer_job_types::{RetryPaymentJob, TimerJob};
use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use constants::{
    MEMO_GROUP_IMPORT_INTO_COMMUNITY, MEMO_JOINING_FEE, OPENCHAT_TREASURY_CANISTER_ID, SNS_GOVERNANCE_CANISTER_ID,
};
use group_community_common::{PaymentRecipient, PendingPayment, PendingPaymentReason};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::{Memo, TransferArg};
use ledger_utils::icrc1::make_transfer;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{C2CError, TimestampNanos};
use utils::payment_retries::retry_delay;

// The number of a payment's failed calls into its ledger which are logged
const MAX_FAILURES_LOGGED: u32 = 3;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static LAST_CREATED_AT_TIME: Cell<TimestampNanos> = Cell::default();
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
    run_regular_jobs();

    let (pending_payment, now_nanos) = mutate_state(|state| (state.data.pending_payments_queue.pop(), state.env.now_nanos()));

    if let Some(pending_payment) = pending_payment {
        utils::async_work::spawn_tracked(process_payment(pending_payment, 0, now_nanos));
        read_state(start_job_if_required);
    }
}

// Called once a payment whose ledger couldn't be called is due to be retried
pub(crate) fn retry(pending_payment: PendingPayment, failures: u32) {
    let now_nanos = mutate_state(|state| {
        // Clears out the entry which the retry's timer job has left behind, along with any others,
        // whatever the outcome of the retry
        state.data.timer_jobs.remove_completed_jobs();
        state.env.now_nanos()
    });
    utils::async_work::spawn_tracked(process_payment(pending_payment, failures, now_nanos));
}

// `previous_failures` is the number of earlier attempts at the payment which failed to call into
// its ledger
async fn process_payment(pending_payment: PendingPayment, previous_failures: u32, now_nanos: TimestampNanos) {
    let to = match pending_payment.recipient {
        // Note in the case of CHAT this will cause the tokens to be burned
        PaymentRecipient::SnsTreasury => SNS_GOVERNANCE_CANISTER_ID.into(),
        PaymentRecipient::TreasuryCanister => OPENCHAT_TREASURY_CANISTER_ID.into(),
        PaymentRecipient::Member(user_id) => types::icrc1::Account::legacy_for_user(user_id).into(),
        PaymentRecipient::Account(account) => account,
        PaymentRecipient::MemberV2(user) => user.into(),
    };

    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: Some(pending_payment.fee.into()),
        created_at_time: Some(unique_created_at_time(now_nanos)),
        memo: Some(memo(pending_payment.reason)),
        amount: pending_payment.amount.into(),
    };

    match make_transfer(pending_payment.ledger_canister, &args, true).await {
        Ok(Ok(_)) => {
            if matches!(pending_payment.reason, PendingPaymentReason::AccessGate)
                && let Some(user_id) = pending_payment.recipient.user_id()
            {
                mutate_state(|state| {
                    state
                        .data
                        .total_payment_receipts
                        .add(pending_payment.ledger_canister, pending_payment.amount, user_id);
                });
            }
        }
        Ok(Err(_)) => {}
        Err(error) => mutate_state(|state| on_failed_to_call_ledger(pending_payment, previous_failures, error, state)),
    }
}

// Rather than putting the payment straight back on the queue, which would call a ledger that keeps
// failing round after round, the payment is retried after a delay which grows with each failure. Each
// attempt gives the transfer a new `created_at_time`, so the ledger never rejects a retry as too old.
fn on_failed_to_call_ledger(
    pending_payment: PendingPayment,
    previous_failures: u32,
    error: C2CError,
    state: &mut RuntimeState,
) {
    let failures = previous_failures.saturating_add(1);

    match retry_delay(&error, failures) {
        Some(delay) => {
            // A group being imported into a community is deleted once the import is complete, which
            // doesn't wait for the group's funds to have been transferred to the community, so that
            // transfer is retried straight away, as every payment used to be, rather than after a
            // delay which could outlast the group
            let delay = if matches!(
                pending_payment.reason,
                PendingPaymentReason::TransferToCommunityBeingImportedInto
            ) {
                0
            } else {
                delay
            };
            // Only the first few failures are logged, so that a ledger which keeps failing doesn't
            // fill the logs
            if failures <= MAX_FAILURES_LOGGED {
                error!(
                    ledger = %pending_payment.ledger_canister,
                    failures,
                    delay,
                    ?error,
                    "Failed to call into ledger to make payment, will retry"
                );
            }
            let now = state.env.now();
            state.data.timer_jobs.enqueue_job(
                TimerJob::RetryPayment(Box::new(RetryPaymentJob {
                    payment: pending_payment,
                    failures,
                })),
                now + delay,
                now,
            );
        }
        None => {
            error!(
                ledger = %pending_payment.ledger_canister,
                ?error,
                "Parked payment, as its ledger is uninstalled or deleted"
            );
            state.data.pending_payments_queue.park(pending_payment);
        }
    }
}

// Returns a `created_at_time` which no earlier transfer from this canister has had. Time doesn't pass
// within a round, and several payments can be attempted in one (eg. retries which all fell due while
// the canister was being upgraded), so two equal payments to the same member would otherwise be
// identical, and the ledger would reject the second as a duplicate. The last one given isn't
// persisted across upgrades, since time moves on while the canister is upgraded.
fn unique_created_at_time(now_nanos: TimestampNanos) -> TimestampNanos {
    let created_at_time = now_nanos.max(LAST_CREATED_AT_TIME.get() + 1);
    LAST_CREATED_AT_TIME.set(created_at_time);
    created_at_time
}

fn memo(reason: PendingPaymentReason) -> Memo {
    match reason {
        PendingPaymentReason::AccessGate => MEMO_JOINING_FEE.to_vec().into(),
        PendingPaymentReason::TransferToCommunityBeingImportedInto => MEMO_GROUP_IMPORT_INTO_COMMUNITY.to_vec().into(),
    }
}
