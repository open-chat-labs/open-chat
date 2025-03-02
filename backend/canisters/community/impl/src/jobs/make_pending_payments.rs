use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use constants::{
    MEMO_GROUP_IMPORT_INTO_COMMUNITY, MEMO_JOINING_FEE, OPENCHAT_TREASURY_CANISTER_ID, SNS_GOVERNANCE_CANISTER_ID,
};
use group_community_common::{PaymentRecipient, PendingPayment, PendingPaymentReason};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::transfer::{Memo, TransferArg};
use ledger_utils::icrc1::make_transfer;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::TimestampNanos;

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

    let (pending_payment, now_nanos) = mutate_state(|state| (state.data.pending_payments_queue.pop(), state.env.now_nanos()));

    if let Some(pending_payment) = pending_payment {
        ic_cdk::futures::spawn(process_payment(pending_payment, now_nanos));
        read_state(start_job_if_required);
    }
}

async fn process_payment(pending_payment: PendingPayment, now_nanos: TimestampNanos) {
    let to = match pending_payment.recipient {
        // Note in the case of CHAT this will cause the tokens to be burned
        PaymentRecipient::SnsTreasury => SNS_GOVERNANCE_CANISTER_ID.into(),
        PaymentRecipient::TreasuryCanister => OPENCHAT_TREASURY_CANISTER_ID.into(),
        PaymentRecipient::Member(user_id) => Principal::from(user_id).into(),
        PaymentRecipient::Account(account) => account,
    };

    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: Some(pending_payment.fee.into()),
        created_at_time: Some(now_nanos),
        memo: Some(memo(pending_payment.reason)),
        amount: pending_payment.amount.into(),
    };

    match make_transfer(pending_payment.ledger_canister, &args, true).await {
        Ok(Ok(_)) => {
            if matches!(pending_payment.reason, PendingPaymentReason::AccessGate) {
                if let PaymentRecipient::Member(user_id) = pending_payment.recipient {
                    mutate_state(|state| {
                        state
                            .data
                            .total_payment_receipts
                            .add(pending_payment.ledger_canister, pending_payment.amount, user_id);
                    });
                }
            }
        }
        Ok(Err(_)) => {}
        Err(_) => {
            mutate_state(|state| {
                state.data.pending_payments_queue.push(pending_payment);
                start_job_if_required(state);
            });
        }
    }
}

fn memo(reason: PendingPaymentReason) -> Memo {
    match reason {
        PendingPaymentReason::AccessGate => MEMO_JOINING_FEE.to_vec().into(),
        PendingPaymentReason::TransferToCommunityBeingImportedInto => MEMO_GROUP_IMPORT_INTO_COMMUNITY.to_vec().into(),
    }
}
