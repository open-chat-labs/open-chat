use crate::{mutate_state, Prize, RuntimeState};
use ic_ledger_types::Tokens;
use icrc_ledger_types::icrc1::account::Account;
use ledger_utils::icrc1;
use rand::Rng;
use std::{cmp, time::Duration};
use tracing::{error, trace};
use types::{
    CanisterId, CompletedCryptoTransaction, CryptoTransaction, Cryptocurrency, MessageContentInitial, MessageId,
    PrizeContentInitial, TimestampMillis, TimestampNanos,
};

pub(crate) fn start_job(state: &mut RuntimeState) {
    if let Some(time_until_next_prize) = time_until_next_prize(state) {
        ic_cdk_timers::set_timer(time_until_next_prize, run);
    }
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
        ic_cdk_timers::set_timer(time_until_next_prize, run);
    }
}

async fn send_next_prize() -> bool {
    // 1. Read a bunch of data from the runtime state, pick a random group and prize
    let Some((ledger_canister_id, group, token, prize, end_date, now_nanos, bot_name)) = mutate_state(|state| {
        if !state.data.started {
            error!("Not started");
            return None;
        }
        if let Some(group) = state.pick_random_group() {
            if let Some(prize_data) = &mut state.data.prize_data {
                if let Some(prize) = prize_data.prizes.pop() {
                    return Some((
                        prize_data.ledger_canister_id,
                        group,
                        prize_data.token.clone(),
                        prize,
                        prize_data.end_date,
                        state.env.now_nanos(),
                        state.data.username.clone(),
                    ));
                } else {
                    error!("No prizes left");
                }
            } else {
                error!("Not initialized");
            }
        } else {
            error!("Not a member of any groups");
        }

        None
    }) else {
        return false;
    };

    // 2. Transfer the prize funds to the group
    let amount = prize.iter().sum::<u64>() + (token.fee().unwrap() as u64) * (prize.len() as u64);
    let completed_transaction =
        match transfer_prize_funds_to_group(ledger_canister_id, token, group, amount as u128, now_nanos).await {
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

    // 3. Generate a random MessageId
    let new_message_id = mutate_state(|state| state.env.rng().gen());

    // 4. Send the prize message to the group
    if let Err(error_message) =
        send_prize_message_to_group(group, completed_transaction, prize, end_date, new_message_id, bot_name).await
    {
        error!(?error_message, ?group, "Failed to send prize message to group");
        return false;
    }

    true
}

fn time_until_next_prize(state: &mut RuntimeState) -> Option<Duration> {
    if !state.data.started {
        trace!("Not started");
        return None;
    }

    let now = state.env.now();
    let time_remaining = Duration::from_millis(match &state.data.prize_data {
        Some(prize_data) => {
            if prize_data.end_date > now {
                prize_data.end_date - now
            } else {
                error!("Out of time");
                return None;
            }
        }
        None => {
            error!("Not initialized");
            return None;
        }
    });

    let rnd: f64 = state.env.rng().gen();
    let mean = state.data.mean_time_between_prizes;
    let next = Duration::from_millis(next_time(mean, rnd));

    if next > time_remaining {
        error!("Not enough time remaining");
        None
    } else {
        Some(next)
    }
}

// Use the inverse exponential function to calculate the next time but
// cap the maximum next time at 5x the mean
fn next_time(mean: TimestampMillis, rnd: f64) -> TimestampMillis {
    cmp::min((-1.0 * mean as f64 * f64::ln(rnd)) as u64, 5 * mean)
}

async fn transfer_prize_funds_to_group(
    ledger_canister_id: CanisterId,
    token: Cryptocurrency,
    group: CanisterId,
    amount: u128,
    now_nanos: TimestampNanos,
) -> Result<CompletedCryptoTransaction, String> {
    // Assume ICRC-1 for now
    let pending_transaction = types::icrc1::PendingCryptoTransaction {
        ledger: ledger_canister_id,
        fee: token.fee().unwrap(),
        token,
        amount,
        to: Account::from(group),
        memo: None,
        created: now_nanos,
    };

    match icrc1::process_transaction(pending_transaction, group).await {
        Ok(completed_transaction) => mutate_state(|state| {
            let completed_transaction = CompletedCryptoTransaction::from(completed_transaction);
            state.data.prizes_sent.push(Prize {
                group,
                transaction: completed_transaction.clone(),
            });
            Ok(completed_transaction)
        }),
        Err(failed_transaction) => Err(format!("{failed_transaction:?}")),
    }
}

async fn send_prize_message_to_group(
    group: CanisterId,
    completed_transaction: CompletedCryptoTransaction,
    prize: Vec<u64>,
    end_date: TimestampMillis,
    message_id: MessageId,
    bot_name: String,
) -> Result<(), String> {
    let content = MessageContentInitial::Prize(PrizeContentInitial {
        prizes: prize.iter().map(|p| Tokens::from_e8s(*p)).collect(),
        transfer: CryptoTransaction::Completed(completed_transaction.clone()),
        end_date,
        caption: None,
        diamond_only: false,
    });

    let c2c_args = group_canister::send_message_v2::Args {
        message_id,
        thread_root_message_index: None,
        content,
        sender_name: bot_name,
        sender_display_name: None,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        rules_accepted: None,
        message_filter_failed: None,
        correlation_id: 0,
    };

    use group_canister::send_message_v2::Response;
    match group_canister_c2c_client::send_message_v2(group, &c2c_args).await {
        Ok(response) => match response {
            Response::Success(_) => Ok(()),
            Response::CallerNotInGroup => Err("Bot not in group".to_string()),
            Response::UserSuspended => Err("Bot suspended".to_string()),
            Response::ChatFrozen => Err("Group frozen".to_string()),
            Response::MessageEmpty
            | Response::RulesNotAccepted
            | Response::InvalidPoll(_)
            | Response::NotAuthorized
            | Response::ThreadMessageNotFound
            | Response::InvalidRequest(_)
            | Response::TextTooLong(_) => unreachable!(),
        },
        // TODO: We should retry sending the message
        Err(error) => Err(format!("{error:?}")),
    }
}
