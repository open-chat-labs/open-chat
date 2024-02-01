use crate::model::pending_payments_queue::PendingPayment;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::{BlockIndex, TransferArg};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use utils::consts::MEMO_TRANSLATION_PAYMENT;

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
    let result = make_payment(&pending_payment).await;

    mutate_state(|state| {
        match result {
            Ok(_) => (),
            Err(retry) => {
                if retry {
                    state.data.pending_payments_queue.push(pending_payment);
                }
            }
        }
        start_job_if_required(state);
    });
}

// Error response contains a boolean stating if the transfer should be retried
async fn make_payment(pending_payment: &PendingPayment) -> Result<BlockIndex, bool> {
    let args = TransferArg {
        from_subaccount: None,
        to: pending_payment.recipient_account,
        fee: None,
        created_at_time: Some(pending_payment.timestamp),
        memo: Some(MEMO_TRANSLATION_PAYMENT.to_vec().into()),
        amount: pending_payment.amount.into(),
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(pending_payment.currency.ledger_canister_id().unwrap(), &args).await {
        Ok(Ok(block_index)) => Ok(block_index.0.into()),
        Ok(Err(transfer_error)) => {
            error!(?transfer_error, ?args, "Transfer failed");
            Err(false)
        }
        Err(error) => {
            error!(?error, ?args, "Transfer failed");
            Err(true)
        }
    }
}
