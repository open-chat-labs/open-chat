use crate::model::pending_actions_queue::{Action, TransferCkbtc};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{
    icrc1, BotMessage, CanisterId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency,
    MessageContentInitial,
};

const MAX_BATCH_SIZE: usize = 5;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_actions_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'process_pending_actions' job started");
        true
    } else {
        false
    }
}

fn run() {
    let batch = mutate_state(next_batch);
    if !batch.is_empty() {
        ic_cdk::spawn(process_actions(batch));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'process_pending_actions' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Vec<Action> {
    (0..MAX_BATCH_SIZE)
        .map_while(|_| state.data.pending_actions_queue.pop())
        .collect()
}

async fn process_actions(actions: Vec<Action>) {
    let futures: Vec<_> = actions.into_iter().map(process_action).collect();

    futures::future::join_all(futures).await;
}

async fn process_action(action: Action) {
    match action.clone() {
        Action::SendMessages(user_id, messages) => {
            if user_canister_c2c_client::c2c_handle_bot_messages(
                CanisterId::from(user_id),
                &user_canister::c2c_handle_bot_messages::Args {
                    bot_name: read_state(|state| state.data.username.clone()),
                    bot_display_name: None,
                    messages: messages
                        .into_iter()
                        .map(|m| BotMessage {
                            thread_root_message_id: None,
                            content: m,
                            message_id: None,
                        })
                        .collect(),
                },
            )
            .await
            .is_err()
            {
                mutate_state(|state| state.enqueue_pending_action(action));
            }
        }
        Action::TransferCkbtc(TransferCkbtc {
            user_id,
            amount,
            send_oc_message,
        }) => {
            let (this_canister_id, ledger_canister_id, now) =
                read_state(|state| (state.env.canister_id(), state.data.ckbtc_ledger_canister_id, state.env.now()));

            let from = Account::from(this_canister_id);
            let now_nanos = now * 1_000_000;

            let args = TransferArg {
                from_subaccount: None,
                to: Account::from(Principal::from(user_id)),
                fee: Some(10u32.into()),
                created_at_time: Some(now_nanos),
                memo: None,
                amount: amount.into(),
            };

            match icrc_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, &args).await {
                Ok(Ok(block_index)) => {
                    if send_oc_message {
                        mutate_state(|state| {
                            state.enqueue_pending_action(Action::SendMessages(
                                user_id,
                                vec![MessageContentInitial::Crypto(CryptoContent {
                                    recipient: user_id,
                                    transfer: CryptoTransaction::Completed(CompletedCryptoTransaction::ICRC1(
                                        icrc1::CompletedCryptoTransaction {
                                            ledger: Cryptocurrency::CKBTC.ledger_canister_id().unwrap(),
                                            token: Cryptocurrency::CKBTC,
                                            amount: amount as u128,
                                            fee: 10,
                                            from: from.into(),
                                            to: Account::from(Principal::from(user_id)).into(),
                                            memo: None,
                                            created: now_nanos,
                                            block_index: block_index.0.try_into().unwrap(),
                                        },
                                    )),
                                    caption: None,
                                })],
                            ))
                        });
                    }
                }
                Ok(Err(TransferError::InsufficientFunds { balance })) => {
                    error!(?args, ?balance, "Failed to transfer ckBTC, insufficient funds");
                    mutate_state(|state| {
                        state.enqueue_pending_action(Action::TransferCkbtc(TransferCkbtc {
                            user_id,
                            amount: balance.0.try_into().unwrap(),
                            send_oc_message,
                        }))
                    })
                }
                Ok(error) => {
                    error!(?args, ?error, "Failed to transfer ckBTC");
                }
                Err(error) => {
                    error!(?args, ?error, "Failed to transfer ckBTC, retrying");
                    mutate_state(|state| state.enqueue_pending_action(action))
                }
            }
        }
    }
}
