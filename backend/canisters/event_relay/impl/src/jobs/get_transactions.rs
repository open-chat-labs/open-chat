use crate::{mutate_state, read_state};
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use event_store_producer::EventBuilder;
use ic_cdk::api::call::CallResult;
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, Transaction};
use serde::Serialize;
use std::cell::Cell;
use std::convert::Into;
use std::time::Duration;
use types::{CanisterId, Milliseconds};

const DEFAULT_INTERVAL: Milliseconds = MINUTE_IN_MS;
const BATCH_SIZE: usize = 1000;

thread_local! {
    static STARTED: Cell<bool> = Cell::default();
}

pub(crate) fn start_job_if_required() -> bool {
    if !STARTED.get() {
        ic_cdk_timers::set_timer(Duration::ZERO, run);
        STARTED.set(true);
        true
    } else {
        false
    }
}

fn run() {
    ic_cdk::spawn(async {
        let delay = run_async().await;
        ic_cdk_timers::set_timer(Duration::from_millis(delay), run);
    });
}

async fn run_async() -> Milliseconds {
    let (start, ledger_canister_id, treasury_account) = read_state(|state| {
        (
            state.data.ledger_transaction_processed_up_to.map_or(0, |i| i + 1),
            state.data.chat_ledger_canister_id,
            state.data.chat_treasury_account(),
        )
    });

    let Ok(transactions) = get_transactions(start, ledger_canister_id).await else {
        return DEFAULT_INTERVAL;
    };

    let mut events = Vec::new();
    let end = start + transactions.len() as u64 - 1;
    let delay = if transactions.len() >= BATCH_SIZE { 0 } else { DEFAULT_INTERVAL };

    for (index, transaction) in transactions.into_iter().enumerate().map(|(i, t)| (i as u64 + start, t)) {
        if let Some(mint) = transaction.mint {
            let timestamp = transaction.timestamp / NANOS_PER_MILLISECOND;
            let payload = TransactionPayload {
                index,
                amount: mint.amount.0.try_into().unwrap(),
            };
            events.push(
                EventBuilder::new("mint", timestamp)
                    .with_source(ledger_canister_id.to_string(), false)
                    .with_json_payload(&payload)
                    .build(),
            );
            if mint.to == treasury_account {
                events.push(
                    EventBuilder::new("transfer_to_treasury", timestamp)
                        .with_source(ledger_canister_id.to_string(), false)
                        .with_json_payload(&payload)
                        .build(),
                );
            }
        } else if let Some(burn) = transaction.burn {
            let timestamp = transaction.timestamp / NANOS_PER_MILLISECOND;
            let payload = TransactionPayload {
                index,
                amount: burn.amount.0.try_into().unwrap(),
            };
            events.push(
                EventBuilder::new("burn", timestamp)
                    .with_source(ledger_canister_id.to_string(), false)
                    .with_json_payload(&payload)
                    .build(),
            );
            if burn.from == treasury_account {
                events.push(
                    EventBuilder::new("transfer_from_treasury", timestamp)
                        .with_source(ledger_canister_id.to_string(), false)
                        .with_json_payload(&payload)
                        .build(),
                );
            }
        } else if let Some(transfer) = transaction.transfer {
            if transfer.from == treasury_account {
                events.push(
                    EventBuilder::new("transfer_from_treasury", transaction.timestamp / NANOS_PER_MILLISECOND)
                        .with_source(ledger_canister_id.to_string(), false)
                        .with_json_payload(&TransactionPayload {
                            index,
                            amount: transfer.amount.0.try_into().unwrap(),
                        })
                        .build(),
                );
            } else if transfer.to == treasury_account {
                events.push(
                    EventBuilder::new("transfer_to_treasury", transaction.timestamp / NANOS_PER_MILLISECOND)
                        .with_source(ledger_canister_id.to_string(), false)
                        .with_json_payload(&TransactionPayload {
                            index,
                            amount: transfer.amount.0.try_into().unwrap(),
                        })
                        .build(),
                );
            }
        }
    }

    mutate_state(|state| {
        state.data.ledger_transaction_processed_up_to = Some(end);
        if !events.is_empty() {
            state.data.event_store_client.push_many(events.into_iter(), true);
        }
    });
    delay
}

async fn get_transactions(start: u64, ledger_canister_id: CanisterId) -> CallResult<Vec<Transaction>> {
    let response = sns_ledger_canister_c2c_client::get_transactions(
        ledger_canister_id,
        &GetTransactionsRequest {
            start: start.into(),
            length: BATCH_SIZE.into(),
        },
    )
    .await?;

    let mut transactions = Vec::new();
    for archive in response.archived_transactions {
        let archive_response = sns_archive_canister_c2c_client::get_transactions(
            archive.callback.canister_id,
            &GetTransactionsRequest {
                start: archive.start,
                length: archive.length,
            },
        )
        .await?;

        transactions.extend(archive_response.transactions);
    }

    transactions.extend(response.transactions);

    Ok(transactions)
}

#[derive(Serialize)]
struct TransactionPayload {
    index: u64,
    amount: u64,
}
