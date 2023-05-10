use crate::model::btc_miami_payments_queue::PendingPayment;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_base_types::PrincipalId;
use ic_cdk_timers::TimerId;
use ic_icrc1::Account;
use ic_ledger_types::{BlockIndex, Tokens};
use ledger_utils::sns::transaction_hash;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
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

    let transaction_hash = transaction_hash(ic_icrc1::Account::from(PrincipalId(this_canister_id)), &args);

    let ckbtc_client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id: CanisterId::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(),
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    match ckbtc_client.transfer(args).await {
        Ok(Ok(block_index)) => return Ok((block_index, transaction_hash)),
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
                token: Cryptocurrency::CKBTC,
                amount,
                fee: Tokens::from_e8s(10),
                from: CryptoAccount::Account(Account::from(PrincipalId(Principal::from(OPENCHAT_BOT_USER_ID)))),
                to: CryptoAccount::Account(Account::from(PrincipalId(Principal::from(user_id)))),
                memo: None,
                created: pending_payment.timestamp,
                transaction_hash,
                block_index,
            })),
            caption: Some("Here are your 50,000 sats as [ckBTC](https://internetcomputer.org/ckbtc)!".to_string()),
        }),
        MessageContent::Text(TextContent {
            text: "No one to send your ckBTC to? Invite your friends to chat!".to_string(),
        }),
        MessageContent::Custom(CustomContent {
            kind: "user_referral_card".to_string(),
            data: Vec::new(),
        }),
        MessageContent::Text(TextContent {
            text: "Find out more about OpenChat [here](/home)".to_string(),
        }),
    ];

    for message in messages {
        state.push_oc_bot_message_to_user(user_id, message);
    }
}
