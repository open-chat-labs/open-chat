use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::LocalUserIndexEvent;
use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use ic_icrc1::Account;
use ic_ledger_types::{BlockIndex, Tokens};
use local_user_index_canister::OpenChatBotMessage;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{Cryptocurrency, MessageContent, TextContent};
use utils::consts::SNS_ROOT_CANISTER_ID;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.pending_payments_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'make_pending_payments' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some(pending_payment) = mutate_state(|state| state.data.pending_payments_queue.pop()) {
        ic_cdk::spawn(process_payment(pending_payment));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'make_pending_payments' job stopped");
    }
}

async fn process_payment(pending_payment: PendingPayment) {
    match make_payment(&pending_payment).await {
        Ok(block_index) => match pending_payment.reason {
            PendingPaymentReason::Treasury => (),
            PendingPaymentReason::ReferralReward => mutate_state(|state| inform_referrer(&pending_payment, block_index, state)),
        },
        Err(_) => {
            mutate_state(|state| state.data.pending_payments_queue.push(pending_payment));
        }
    }
}

async fn make_payment(pending_payment: &PendingPayment) -> Result<BlockIndex, ()> {
    let to = Account {
        owner: pending_payment.recipient.into(),
        subaccount: None,
    };

    let args = ic_icrc1::endpoints::TransferArg {
        from_subaccount: None,
        to,
        fee: None,
        created_at_time: Some(pending_payment.timestamp),
        memo: None,
        amount: pending_payment.amount.into(),
    };

    let client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id: pending_payment.currency.ledger_canister_id(),
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    match client.transfer(args).await {
        Ok(Ok(block_index)) => return Ok(block_index),
        Ok(Err(transfer_error)) => error!("Transfer failed. {transfer_error:?}"),
        Err((code, msg)) => error!("Transfer failed. {code:?}: {msg}"),
    }

    Err(())
}

fn inform_referrer(pending_payment: &PendingPayment, block_index: BlockIndex, state: &mut RuntimeState) {
    let user_id = pending_payment.recipient.into();
    let amount = Tokens::from_e8s(pending_payment.amount);
    let symbol = pending_payment.currency.token_symbol();
    let mut amount_text = format!("{} {}", amount, symbol);

    if matches!(pending_payment.currency, Cryptocurrency::CHAT) {
        let link = format!(
            "https://dashboard.internetcomputer.org/sns/{}/transaction/{}",
            SNS_ROOT_CANISTER_ID, block_index
        );
        amount_text = format!("[{}]({})", amount_text, link);
    }

    state.push_event_to_local_user_index(
        user_id,
        LocalUserIndexEvent::OpenChatBotMessage(OpenChatBotMessage {
            user_id,
            message: MessageContent::Text(TextContent {
                text: format!("You have received a referral reward of {}. This is because one of the users you referred has made a Diamond membership payment.", amount_text),
            }),
        }),
    );
}
