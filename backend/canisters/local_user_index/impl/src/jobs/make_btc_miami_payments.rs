use crate::model::btc_miami_payments_queue::PendingPayment;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use ic_ledger_types::{BlockIndex, Tokens};
use ledger_utils::sns::transaction_hash;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::icrc1::{Account, TransferArg};
use types::sns::CryptoAccount;
use types::{
    sns, CanisterId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, CustomContent,
    MessageContent, TextContent, TransactionHash,
};
use utils::consts::OPENCHAT_BOT_USER_ID;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.btc_miami_payments_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'make_btc_miami_payments' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some((pending_payment, this_canister_id)) = mutate_state(|state| {
        state
            .data
            .btc_miami_payments_queue
            .pop()
            .map(|p| (p, state.env.canister_id()))
    }) {
        ic_cdk::spawn(process_payment(pending_payment, this_canister_id));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'make_btc_miami_payments' job stopped");
    }
}

async fn process_payment(pending_payment: PendingPayment, this_canister_id: CanisterId) {
    match make_payment(&pending_payment, this_canister_id).await {
        Ok((block_index, transaction_hash)) => {
            mutate_state(|state| send_oc_bot_messages(&pending_payment, block_index, transaction_hash, state));
        }
        Err(_) => {
            mutate_state(|state| {
                state.data.btc_miami_payments_queue.push(pending_payment);
                start_job_if_required(state);
            });
        }
    }
}

async fn make_payment(
    pending_payment: &PendingPayment,
    this_canister_id: CanisterId,
) -> Result<(BlockIndex, TransactionHash), ()> {
    let to = Account::from(pending_payment.recipient);

    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: None,
        created_at_time: Some(pending_payment.timestamp),
        memo: None,
        amount: pending_payment.amount.into(),
    };

    let transaction_hash = transaction_hash(Account::from(this_canister_id), &args);

    match icrc1_ledger_canister_c2c_client::icrc1_transfer(Cryptocurrency::CKBTC.ledger_canister_id().unwrap(), &args).await {
        Ok(Ok(block_index)) => return Ok((block_index.0.try_into().unwrap(), transaction_hash)),
        Ok(Err(transfer_error)) => error!("Transfer failed. {transfer_error:?}"),
        Err((code, msg)) => error!("Transfer failed. {code:?}: {msg}"),
    }

    Err(())
}

fn send_oc_bot_messages(
    pending_payment: &PendingPayment,
    block_index: BlockIndex,
    transaction_hash: TransactionHash,
    state: &mut RuntimeState,
) {
    let user_id = pending_payment.recipient.into();
    let amount = Tokens::from_e8s(pending_payment.amount);

    let messages = vec![
        MessageContent::Crypto(CryptoContent {
            recipient: user_id,
            transfer: CryptoTransaction::Completed(CompletedCryptoTransaction::SNS(sns::CompletedCryptoTransaction {
                ledger: Cryptocurrency::CKBTC.ledger_canister_id().unwrap(),
                token: Cryptocurrency::CKBTC,
                amount,
                fee: Tokens::from_e8s(10),
                from: CryptoAccount::Account(Account::from(Principal::from(OPENCHAT_BOT_USER_ID))),
                to: CryptoAccount::Account(Account::from(Principal::from(user_id))),
                memo: None,
                created: pending_payment.timestamp,
                transaction_hash,
                block_index,
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
        state.push_oc_bot_message_to_user(user_id, message);
    }
}
