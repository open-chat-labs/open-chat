use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, RuntimeState};
use crate::{read_state, LocalUserIndexEvent};
use constants::{CHAT_LEDGER_CANISTER_ID, SNS_ROOT_CANISTER_ID};
use ic_cdk_timers::TimerId;
use ic_ledger_types::{BlockIndex, Tokens};
use icrc_ledger_types::icrc1::transfer::TransferArg;
use ledger_utils::icrc1::make_transfer;
use local_user_index_canister::OpenChatBotMessage;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{MessageContent, TextContent};

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
        ic_cdk::futures::spawn(process_payment(pending_payment));
    }
    read_state(start_job_if_required);
}

async fn process_payment(pending_payment: PendingPayment) {
    let reason = pending_payment.reason.clone();
    let args = TransferArg {
        from_subaccount: None,
        to: pending_payment.recipient_account,
        fee: Some(pending_payment.fee.into()),
        created_at_time: Some(pending_payment.timestamp),
        memo: Some(pending_payment.memo.to_vec().into()),
        amount: pending_payment.amount.into(),
    };

    let result = make_transfer(pending_payment.ledger, &args, true).await;

    mutate_state(|state| {
        match result {
            Ok(Ok(block_index)) => {
                if matches!(reason, PendingPaymentReason::ReferralReward) {
                    inform_referrer(&pending_payment, block_index, state);
                }
            }
            Ok(Err(_)) => {}
            Err(_) => {
                state.data.pending_payments_queue.push(pending_payment);
            }
        }
        start_job_if_required(state);
    });
}

fn inform_referrer(pending_payment: &PendingPayment, block_index: BlockIndex, state: &mut RuntimeState) {
    let user_id = pending_payment.recipient_account.owner.into();
    let amount = Tokens::from_e8s(pending_payment.amount);
    let amount_formatted = amount.to_string().trim_end_matches('0').to_string();
    let symbol = pending_payment.token_symbol.clone();
    let mut amount_text = format!("{amount_formatted} {symbol}");

    if pending_payment.ledger == CHAT_LEDGER_CANISTER_ID {
        let link = format!(
            "https://dashboard.internetcomputer.org/sns/{}/transaction/{}",
            SNS_ROOT_CANISTER_ID, block_index
        );
        amount_text = format!("[{}]({})", amount_text, link);
    }

    let message = MessageContent::Text(TextContent { text: format!("You have received a referral reward of {}. This is because one of the users you referred has made a Diamond membership payment.", amount_text) });

    state.push_event_to_local_user_index(
        user_id,
        LocalUserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage { user_id, message })),
    );
}
