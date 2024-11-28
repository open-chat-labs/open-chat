use crate::model::pending_payments_queue::PendingPayment;
use crate::{mutate_state, read_state, RuntimeState};
use constants::{MEMO_TRANSLATION_PAYMENT, NANOS_PER_MILLISECOND};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use ledger_utils::icrc1::make_transfer;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_payments_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
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
        ic_cdk::spawn(process_payment(pending_payment));
        read_state(start_job_if_required);
    }
}

async fn process_payment(pending_payment: PendingPayment) {
    let args = TransferArg {
        from_subaccount: None,
        to: pending_payment.recipient_account,
        fee: None,
        created_at_time: Some(pending_payment.timestamp * NANOS_PER_MILLISECOND),
        memo: Some(MEMO_TRANSLATION_PAYMENT.to_vec().into()),
        amount: pending_payment.amount.into(),
    };

    let result = make_transfer(pending_payment.currency.ledger_canister_id().unwrap(), &args, true).await;

    mutate_state(|state| {
        if result.is_err() {
            state.data.pending_payments_queue.push(pending_payment);
        }
        start_job_if_required(state);
    });
}
