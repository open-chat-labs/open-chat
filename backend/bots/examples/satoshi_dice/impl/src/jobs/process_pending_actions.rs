use crate::model::pending_actions_queue::{Action, TransferCkbtc};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use ic_ledger_types::Tokens;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use ledger_utils::sns::transaction_hash;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{
    sns, BotMessage, CanisterId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContent,
};

const MAX_BATCH_SIZE: usize = 5;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.pending_actions_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
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
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'process_pending_actions' job stopped");
    }
}

fn next_batch(runtime_state: &mut RuntimeState) -> Vec<Action> {
    (0..MAX_BATCH_SIZE)
        .map_while(|_| runtime_state.data.pending_actions_queue.pop())
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
                    messages: messages.into_iter().map(|m| BotMessage { content: m }).collect(),
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

            let ledger_client = ic_icrc1_client::ICRC1Client {
                runtime: ic_icrc1_client_cdk::CdkRuntime,
                ledger_canister_id,
            };

            let from = Account::from(this_canister_id);
            let now_nanos = now * 1_000_000;

            let args = TransferArg {
                from_subaccount: None,
                to: Account::from(Principal::from(user_id)),
                fee: Some(10.into()),
                created_at_time: Some(now_nanos),
                memo: None,
                amount: amount.into(),
            };
            let transaction_hash = transaction_hash(from, &args);

            match ledger_client.transfer(args.clone()).await {
                Ok(Ok(block_index)) => {
                    if send_oc_message {
                        mutate_state(|state| {
                            state.enqueue_pending_action(Action::SendMessages(
                                user_id,
                                vec![MessageContent::Crypto(CryptoContent {
                                    recipient: user_id,
                                    transfer: CryptoTransaction::Completed(CompletedCryptoTransaction::SNS(
                                        sns::CompletedCryptoTransaction {
                                            token: Cryptocurrency::CKBTC,
                                            amount: Tokens::from_e8s(amount),
                                            fee: Tokens::from_e8s(10),
                                            from: sns::CryptoAccount::Account(from),
                                            to: sns::CryptoAccount::Account(Account::from(Principal::from(user_id))),
                                            memo: None,
                                            created: now_nanos,
                                            transaction_hash,
                                            block_index,
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
