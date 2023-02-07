use candid::Principal;
use ic_ledger_types::Tokens;
use ledger_utils::sns;
use tracing::{error, trace};
use types::{
    CanisterId, CompletedCryptoTransaction, CryptoTransaction, Cryptocurrency, MessageContentInitial, MessageId,
    PrizeContentInitial, TimestampMillis, TimestampNanos,
};

use crate::{mutate_state, read_state, Prize, RuntimeState};
use std::time::Duration;

const ONE_MINUTE_IN_MILLIS: TimestampMillis = 1000 * 60;
const ONE_HOUR_IN_MILLIS: TimestampMillis = ONE_MINUTE_IN_MILLIS * 60;

pub(crate) fn start_job(state: &RuntimeState) {
    ic_cdk::timer::set_timer(Duration::from_millis(10 * ONE_MINUTE_IN_MILLIS), run);
}

fn run() {
    ic_cdk::spawn(send_prizes_impl());
}

async fn send_prizes_impl() {
    trace!("Send prize started");

    if send_next_prize().await {
        trace!("Send prize succeeded");
    } else {
        trace!("Send prize failed");
    }

    if let Some(time_until_next_prize) = mutate_state(time_until_next_prize) {
        ic_cdk::timer::set_timer(time_until_next_prize, run);
    }
}

async fn send_next_prize() -> bool {
    // 1. Try to read the ledger_canister_id and bot_canister_id from runtime state
    let (ledger_canister_id, bot_canister_id) = match read_state(|state| {
        state
            .data
            .prize_data
            .as_ref()
            .map(|prize_data| (prize_data.ledger_canister_id, state.env.canister_id()))
    }) {
        Some(ids) => ids,
        None => {
            error!("Not initialized");
            return false;
        }
    };

    // 2. Call the ledger canister to get the balance
    let balance = match get_balance(ledger_canister_id, bot_canister_id).await {
        Ok(balance) => {
            if balance == 0 {
                trace!("Prize account is empty");
                return false;
            }
            balance
        }
        Err(error_message) => {
            error!(?error_message, ?ledger_canister_id, ?bot_canister_id, "Failed to get balance");
            return false;
        }
    };

    // 3. Read a bunch of data from the runtime state, pick a random group and prize
    let (group, prize, now_nanos, bot_name) = match mutate_state(|state| {
        if let Some(group) = state.pick_random_group() {
            if let Some(prize) = state.build_random_prize(balance) {
                return Some((group, prize, state.env.now_nanos(), state.data.username.clone()));
            } else {
                error!("Not initialized");
            }
        } else {
            error!("Not a member of any groups");
        }

        None
    }) {
        Some(t) => t,
        None => return false,
    };

    // 4. Transfer the prize funds to the group
    let amount = prize.prizes.iter().sum::<u64>() + (prize.token.fee() as u64) * (prize.prizes.len() as u64);
    let completed_transaction =
        match transfer_prize_funds_to_group(ledger_canister_id, prize.token, group, amount, now_nanos).await {
            Ok(t) => t,
            Err(error_message) => {
                error!(
                    ?error_message,
                    ?ledger_canister_id,
                    ?group,
                    "Failed to transfer funds to group"
                );
                return false;
            }
        };

    // 5. Generate a random MessageId
    let new_message_id = MessageId::generate(|| mutate_state(|state| state.env.random_u32()));

    // 6. Send the prize message to the group
    if let Err(error_message) = send_prize_message_to_group(group, completed_transaction, prize, new_message_id, bot_name).await
    {
        error!(?error_message, ?group, "Failed to send prize message to group");
        return false;
    }

    true
}

fn time_until_next_prize(state: &mut RuntimeState) -> Option<Duration> {
    let rnd = state.env.random_u32();
    if let Some(prize_data) = &state.data.prize_data {
        if prize_data.end_date < (state.env.now() - ONE_HOUR_IN_MILLIS) {
            // TODO: Choose a random duration based on an exponential function
            // where the average is around 2 hours
            let duration = 2 * ONE_HOUR_IN_MILLIS;
            return Some(Duration::from_millis(duration));
        } else {
            trace!("Not enought time left");
        }
    } else {
        trace!("Not initialized");
    }
    None
}

async fn get_balance(ledger_canister_id: CanisterId, principal: Principal) -> Result<u64, String> {
    let principal = ic_base_types::PrincipalId::from(principal);

    let client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id,
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    client
        .balance_of(ic_icrc1::Account {
            owner: principal,
            subaccount: None,
        })
        .await
        .map_err(|(_, message)| message)
}

async fn transfer_prize_funds_to_group(
    ledger_canister_id: CanisterId,
    token: Cryptocurrency,
    group: CanisterId,
    amount: u64,
    now_nanos: TimestampNanos,
) -> Result<CompletedCryptoTransaction, String> {
    // Assume ICRC-1 for now
    let pending_transaction = types::sns::PendingCryptoTransaction {
        token,
        amount: Tokens::from_e8s(amount),
        to: ic_icrc1::Account {
            owner: ic_base_types::PrincipalId::from(group),
            subaccount: None,
        },
        fee: Tokens::from_e8s(token.fee() as u64),
        memo: None,
    };

    match sns::process_transaction(pending_transaction, group, ledger_canister_id, now_nanos).await {
        Ok(completed_transaction) => mutate_state(|state| {
            state.data.transactions.push(completed_transaction.clone());
            Ok(completed_transaction)
        }),
        Err(failed_transaction) => Err(format!("{failed_transaction:?}")),
    }
}

async fn send_prize_message_to_group(
    group: CanisterId,
    completed_transaction: CompletedCryptoTransaction,
    prize: Prize,
    message_id: MessageId,
    bot_name: String,
) -> Result<(), String> {
    let content = MessageContentInitial::Prize(PrizeContentInitial {
        prizes: prize.prizes.iter().map(|p| Tokens::from_e8s(*p)).collect(),
        transfer: CryptoTransaction::Completed(completed_transaction.clone()),
        end_date: prize.end_date,
        caption: None,
    });

    let c2c_args = group_canister::send_message_v2::Args {
        message_id,
        thread_root_message_index: None,
        content,
        sender_name: bot_name,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        correlation_id: 0,
    };

    match group_canister_c2c_client::send_message_v2(group, &c2c_args).await {
        Ok(response) => match response {
            group_canister::send_message::Response::Success(_) => Ok(()),
            group_canister::send_message::Response::CallerNotInGroup => Err("Bot not in group".to_string()),
            group_canister::send_message::Response::UserSuspended => Err("Bot suspended".to_string()),
            group_canister::send_message::Response::ChatFrozen => Err("Group frozen".to_string()),
            group_canister::send_message::Response::MessageEmpty
            | group_canister::send_message::Response::InvalidPoll(_)
            | group_canister::send_message::Response::NotAuthorized
            | group_canister::send_message::Response::ThreadMessageNotFound
            | group_canister::send_message::Response::InvalidRequest(_)
            | group_canister::send_message::Response::TextTooLong(_) => unreachable!(),
        },
        // TODO: We should retry sending the message
        Err(error) => Err(format!("{error:?}")),
    }
}
