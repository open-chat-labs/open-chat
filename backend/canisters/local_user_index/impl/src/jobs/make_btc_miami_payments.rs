use crate::model::btc_miami_payments_queue::PendingPayment;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{BlockIndex, TransferArg};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{
    icrc1, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, CustomContent, MessageContent,
    TextContent,
};
use utils::consts::OPENCHAT_BOT_USER_ID;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.btc_miami_payments_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'make_btc_miami_payments' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some(pending_payment) = mutate_state(|state| state.data.btc_miami_payments_queue.pop()) {
        ic_cdk::spawn(process_payment(pending_payment));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'make_btc_miami_payments' job stopped");
    }
}

async fn process_payment(pending_payment: PendingPayment) {
    match make_payment(&pending_payment).await {
        Ok(block_index) => {
            mutate_state(|state| send_oc_bot_messages(&pending_payment, block_index, state));
        }
        Err(_) => {
            mutate_state(|state| {
                state.data.btc_miami_payments_queue.push(pending_payment);
                start_job_if_required(state);
            });
        }
    }
}

async fn make_payment(pending_payment: &PendingPayment) -> Result<BlockIndex, ()> {
    let to = Account::from(pending_payment.recipient);

    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: None,
        created_at_time: Some(pending_payment.timestamp),
        memo: None,
        amount: pending_payment.amount.into(),
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(Cryptocurrency::CKBTC.ledger_canister_id().unwrap(), &args).await {
        Ok(Ok(block_index)) => return Ok(block_index),
        Ok(Err(transfer_error)) => error!("Transfer failed. {transfer_error:?}"),
        Err((code, msg)) => error!("Transfer failed. {code:?}: {msg}"),
    }

    Err(())
}

fn send_oc_bot_messages(pending_payment: &PendingPayment, block_index: BlockIndex, state: &mut RuntimeState) {
    let user_id = pending_payment.recipient.into();
    let amount = pending_payment.amount as u128;

    let messages = vec![
        MessageContent::Crypto(CryptoContent {
            recipient: user_id,
            transfer: CryptoTransaction::Completed(CompletedCryptoTransaction::ICRC1(icrc1::CompletedCryptoTransaction {
                ledger: Cryptocurrency::CKBTC.ledger_canister_id().unwrap(),
                token: Cryptocurrency::CKBTC,
                amount,
                fee: 10,
                from: Account::from(Principal::from(OPENCHAT_BOT_USER_ID)).into(),
                to: Account::from(Principal::from(user_id)).into(),
                memo: None,
                created: pending_payment.timestamp,
                block_index: block_index.0.try_into().unwrap(),
            })),
            caption: Some("Here are your 50,000 SATS as [ckBTC](https://internetcomputer.org/ckbtc)!".to_string()),
        }),
        MessageContent::Text(TextContent {
            text: "🤔 No one to send your ckBTC to? Invite your friends to chat!".to_string(),
        }),
        MessageContent::Custom(CustomContent {
            kind: "user_referral_card".to_string(),
            data: Vec::new(),
        }),
        MessageContent::Text(TextContent {
            text: format!(
                "🤝 ...or connect with fellow Bitcoiners and win prizes in the [Operation Miami](/{}) chat",
                if state.data.test_mode { "ueyan-5iaaa-aaaaf-bifxa-cai" } else { "pbo6v-oiaaa-aaaar-ams6q-cai" }
            ),
        }),
        MessageContent::Text(TextContent {
            text: format!(
                "🎲 ...or play Satoshi Dice with the [Satoshi Dice](/{}) chat bot",
                if state.data.test_mode { "uuw5d-uiaaa-aaaar-anzeq-cai" } else { "wznbi-caaaa-aaaar-anvea-cai" }
            ),
        }),
        MessageContent::Text(TextContent {
            text: "👀 View projects, wallets, and DEXs that support ckBTC [here](https://internetcomputer.org/ecosystem/?tag=Bitcoin)".to_string(),
        }),
        MessageContent::Text(TextContent {
            text: "🧐 Find out more about OpenChat [here](/home)".to_string(),
        }),
    ];

    for message in messages {
        state.push_oc_bot_message_to_user(user_id, message, Vec::new());
    }
}
