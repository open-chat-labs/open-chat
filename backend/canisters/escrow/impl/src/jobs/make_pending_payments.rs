use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use escrow_canister::{deposit_subaccount, SwapStatus};
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
    let from_user = match pending_payment.reason {
        PendingPaymentReason::Swap(other_user_id) => other_user_id,
        PendingPaymentReason::Refund => pending_payment.user_id,
    };
    let created_at_time = pending_payment.timestamp * NANOS_PER_MILLISECOND;

    let args = TransferArg {
        from_subaccount: Some(deposit_subaccount(from_user, pending_payment.swap_id)),
        to: Principal::from(pending_payment.user_id).into(),
        fee: Some(pending_payment.token_info.fee.into()),
        created_at_time: Some(created_at_time),
        memo: None,
        amount: pending_payment.amount.into(),
    };

    match make_payment(pending_payment.token_info.ledger, &args).await {
        Ok(block_index) => {
            mutate_state(|state| {
                if let Some(swap) = state.data.swaps.get_mut(pending_payment.swap_id) {
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
