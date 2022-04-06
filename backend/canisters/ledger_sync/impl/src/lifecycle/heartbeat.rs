use crate::model::notifications_queue::DepositNotification;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_macros::heartbeat;
use ic_ledger_types::{Block, BlockIndex, Operation};
use ledger_utils::blocks_since;
use tracing::error;
use types::{CanisterId, CompletedICPDeposit, CryptocurrencyDeposit, ICPDeposit};

#[heartbeat]
fn heartbeat() {
    sync_ledger_transactions::run();
    send_notifications::run();
}

mod sync_ledger_transactions {
    use super::*;

    pub fn run() {
        if let Some(block_index_synced_up_to) = mutate_state(|state| {
            let now = state.env.now();
            state.data.ledger_sync_state.try_start(now)
        }) {
            ic_cdk::spawn(sync_transactions(block_index_synced_up_to + 1));
        }
    }

    async fn sync_transactions(from_block_index: BlockIndex) {
        let ledger_canister_id = read_state(|state| state.data.ledger_canister_id);

        match blocks_since(ledger_canister_id, from_block_index, 1000).await {
            Ok(blocks) => mutate_state(|state| process_blocks(blocks, from_block_index, state)),
            Err(error) => error!(?error, "Failed to get blocks from ledger"),
        }

        mutate_state(|state| state.data.ledger_sync_state.mark_sync_complete());
    }

    fn process_blocks(blocks: Vec<Block>, from_block_index: BlockIndex, runtime_state: &mut RuntimeState) {
        if blocks.is_empty() {
            return;
        }

        let last_block_index = from_block_index + blocks.len() as u64;

        for (block_index, block) in blocks
            .into_iter()
            .enumerate()
            .map(|(index, block)| ((index as u64) + from_block_index, block))
        {
            if let Operation::Transfer { from, to, amount, fee } = block.transaction.operation {
                if let Some(canister_id) = runtime_state.data.accounts.canister_id(&to) {
                    if runtime_state.data.accounts.canister_id(&from).is_some() {
                        runtime_state.data.transaction_metrics.mark_transfer(amount);
                    } else {
                        runtime_state.data.transaction_metrics.mark_deposit(amount);
                        runtime_state.data.notifications_queue.add(DepositNotification {
                            canister_id,
                            deposit: CryptocurrencyDeposit::ICP(ICPDeposit::Completed(CompletedICPDeposit {
                                from_address: from,
                                amount,
                                fee,
                                memo: block.transaction.memo,
                                block_index,
                            })),
                        });
                    }
                } else if runtime_state.data.accounts.canister_id(&from).is_some() {
                    runtime_state.data.transaction_metrics.mark_withdrawal(amount);
                }
            }
        }

        runtime_state.data.ledger_sync_state.set_synced_up_to(last_block_index);
    }
}

mod send_notifications {
    use super::*;

    pub fn run() {
        if let Some(next) = mutate_state(|state| state.data.notifications_queue.take()) {
            ic_cdk::spawn(notify_deposit(next.canister_id, next.deposit));
        }
    }

    async fn notify_deposit(canister_id: CanisterId, deposit: CryptocurrencyDeposit) {
        let args = user_canister::c2c_notify_deposit::Args {
            deposit: deposit.clone(),
        };

        if let Err((_, message)) = user_canister_c2c_client::c2c_notify_deposit(canister_id, &args).await {
            // If the target canister is stopped, queue up the notification to be sent again
            if message.to_uppercase().contains("STOPPED") {
                mutate_state(|state| {
                    state
                        .data
                        .notifications_queue
                        .add(DepositNotification { canister_id, deposit })
                });
            }
        }
    }
}
