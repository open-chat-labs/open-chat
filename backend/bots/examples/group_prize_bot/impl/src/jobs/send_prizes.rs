use ic_ledger_types::Tokens;
use ledger_utils::sns;
use tracing::{error, trace};
use types::{
    CanisterId, CompletedCryptoTransaction, CryptoTransaction, Cryptocurrency, MessageContentInitial, MessageId,
    PrizeContentInitial, TimestampMillis, TimestampNanos,
};

use crate::{mutate_state, RuntimeState};
use std::time::Duration;

pub(crate) fn start_job(_state: &RuntimeState) {
    ic_cdk::timer::set_timer(Duration::from_secs(600), run);
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
    // 1. Read a bunch of data from the runtime state, pick a random group and prize
    let (ledger_canister_id, group, token, prize, end_date, now_nanos, bot_name) = match mutate_state(|state| {
        if let Some(group) = state.pick_random_group() {
            if let Some(prize_data) = &mut state.data.prize_data {
                if let Some(prize) = prize_data.prizes.pop() {
                    return Some((
                        prize_data.ledger_canister_id,
                        group,
                        prize_data.token,
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
    }) {
        Some(t) => t,
        None => return false,
    };

    // 2. Transfer the prize funds to the group
    let amount = prize.iter().sum::<u64>() + (token.fee() as u64) * (prize.len() as u64);
    let completed_transaction = match transfer_prize_funds_to_group(ledger_canister_id, token, group, amount, now_nanos).await {
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
    let new_message_id = MessageId::generate(|| mutate_state(|state| state.env.random_u32()));

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

    let rnd = state.env.random();
    let avg_in_hours: f64 = state.data.average_time_between_prizes.as_secs_f64() / 3600_f64;
    let e: f64 = std::f64::consts::E;
    let next_in_hours = avg_in_hours * e.powf(-1.0 * avg_in_hours * rnd);
    let next = Duration::from_secs_f64(next_in_hours * 3600_f64);
    if next > time_remaining {
        error!("Not enough time remaining");
        None
    } else {
        Some(next)
    }
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

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use candid::Principal;
    use utils::env::test::TestEnv;

    use crate::{Data, PrizeData};

    use super::*;

    #[test]
    fn average_time_between_prizes_in_expected_range() {
        for n in 0..10 {
            let mut runtime_state = build_state(n as f64 / 10_f64);
            let time_until_next_prize = time_until_next_prize(&mut runtime_state).unwrap().as_millis();

            // Time with range of 20 minutes to 2 hours
            assert!(time_until_next_prize > (1000 * 60 * 20));
            assert!(time_until_next_prize < (1000 * 3600 * 2));
        }
    }

    fn build_state(random: f64) -> RuntimeState {
        let mut env = TestEnv::default();
        env.random = random;
        let mut data = Data::new(Principal::anonymous(), HashSet::new(), false);
        let now = env.now;

        // 2 hours from now
        let end_date: TimestampMillis = now + (1000 * 3600 * 2);

        // 1 prize with 1 individual prize
        let prizes: Vec<Vec<u64>> = vec![vec![10_000]];
        data.prize_data = Some(PrizeData {
            token: Cryptocurrency::CKBTC,
            ledger_canister_id: Principal::anonymous(),
            prizes,
            end_date,
        });

        data.average_time_between_prizes = Duration::from_millis(end_date - now);

        RuntimeState::new(Box::new(env), data)
    }
}
