use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, RuntimeState};
use crate::{read_state, LocalUserIndexEvent};
use ic_cdk_timers::TimerId;
use ic_ledger_types::{BlockIndex, Tokens};
use icrc_ledger_types::icrc1::transfer::TransferArg;
use local_user_index_canister::OpenChatBotMessage;
use serde::Serialize;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::{Cryptocurrency, MessageContent, TextContent};
use utils::consts::SNS_ROOT_CANISTER_ID;

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
    info!("'make_pending_payments' job running");
    TIMER_ID.set(None);

    if let Some(pending_payment) = mutate_state(|state| state.data.pending_payments_queue.pop()) {
        ic_cdk::spawn(process_payment(pending_payment));
    }
    read_state(start_job_if_required);
}

async fn process_payment(pending_payment: PendingPayment) {
    let reason = pending_payment.reason.clone();
    let result = make_payment(&pending_payment).await;

    mutate_state(|state| {
        match result {
            Ok(block_index) => match reason {
                PendingPaymentReason::ReferralReward => {
                    inform_referrer(&pending_payment, block_index, state);
                }
                PendingPaymentReason::TopUpNeuron => {
                    state.data.refresh_nns_neuron();
                }
                _ => {}
            },
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
        memo: Some(pending_payment.memo.to_vec().into()),
        amount: pending_payment.amount.into(),
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(pending_payment.currency.ledger_canister_id().unwrap(), &args).await {
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

fn inform_referrer(pending_payment: &PendingPayment, block_index: BlockIndex, state: &mut RuntimeState) {
    let user_id = pending_payment.recipient_account.owner.into();
    let amount = Tokens::from_e8s(pending_payment.amount);
    let amount_formatted = amount.to_string().trim_end_matches('0').to_string();
    let symbol = pending_payment.currency.token_symbol();
    let mut amount_text = format!("{amount_formatted} {symbol}");

    if matches!(pending_payment.currency, Cryptocurrency::CHAT) {
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

#[derive(Serialize)]
struct Link {
    url: String,
    caption: String,
}
