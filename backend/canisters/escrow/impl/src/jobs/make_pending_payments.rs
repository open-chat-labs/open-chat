use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use escrow_canister::deposit_subaccount;
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::icrc1::CompletedCryptoTransaction;
use types::CanisterId;
use utils::time::NANOS_PER_MILLISECOND;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_payments_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'make_pending_payments' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some(pending_payment) = mutate_state(|state| state.data.pending_payments_queue.pop()) {
        ic_cdk::spawn(process_payment(pending_payment));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'make_pending_payments' job stopped");
    }
}

async fn process_payment(pending_payment: PendingPayment) {
    let from_user = match pending_payment.reason {
        PendingPaymentReason::Trade(other_user_id) => other_user_id,
        PendingPaymentReason::Refund => pending_payment.user_id,
    };
    let created_at_time = pending_payment.timestamp * NANOS_PER_MILLISECOND;

    let args = TransferArg {
        from_subaccount: Some(deposit_subaccount(from_user, pending_payment.offer_id)),
        to: Principal::from(pending_payment.user_id).into(),
        fee: Some(pending_payment.token_info.fee.into()),
        created_at_time: Some(created_at_time),
        memo: None,
        amount: pending_payment.amount.into(),
    };

    match make_payment(pending_payment.token_info.ledger, &args).await {
        Ok(block_index) => {
            mutate_state(|state| {
                if let Some(offer) = state.data.offers.get_mut(pending_payment.offer_id) {
                    let transfer = CompletedCryptoTransaction {
                        ledger: pending_payment.token_info.ledger,
                        token: pending_payment.token_info.token,
                        amount: pending_payment.amount,
                        from: Account {
                            owner: state.env.canister_id(),
                            subaccount: args.from_subaccount,
                        }
                        .into(),
                        to: Account::from(Principal::from(pending_payment.user_id)).into(),
                        fee: pending_payment.token_info.fee,
                        memo: None,
                        created: created_at_time,
                        block_index,
                    };
                    offer.transfers_out.push(transfer);
                }
            });
        }
        Err(retry) => {
            if retry {
                mutate_state(|state| {
                    state.data.pending_payments_queue.push(pending_payment);
                    start_job_if_required(state);
                });
            }
        }
    }
}

// Error response contains a boolean stating if the transfer should be retried
async fn make_payment(ledger_canister_id: CanisterId, args: &TransferArg) -> Result<u64, bool> {
    match icrc_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, args).await {
        Ok(Ok(block_index)) => Ok(block_index.0.try_into().unwrap()),
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
