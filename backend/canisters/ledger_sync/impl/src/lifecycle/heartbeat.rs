use crate::model::notifications_queue::DepositNotification;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_macros::heartbeat;
use ic_ledger_types::BlockIndex;
use ledger_utils::{blocks_since, latest_block_index, CandidBlock, CandidOperation};
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
        match mutate_state(|state| state.data.ledger_sync_state.try_start()) {
            Some(0) => ic_cdk::spawn(init_block_index()),
            Some(block_index_synced_up_to) => ic_cdk::spawn(sync_transactions(block_index_synced_up_to + 1)),
            None => {}
        }
    }

    async fn init_block_index() {
        let ledger_canister_id = read_state(|state| state.data.ledger_canister_id);

        let block_index = latest_block_index(ledger_canister_id).await.unwrap_or_else(|error| {
            error!(?error, "Failed to get latest block index from ledger");
            0
        });

        mutate_state(|state| state.data.ledger_sync_state.mark_complete(block_index));
    }

    async fn sync_transactions(from_block_index: BlockIndex) {
        let ledger_canister_id = read_state(|state| state.data.ledger_canister_id);

        match blocks_since(ledger_canister_id, from_block_index, 1000).await {
            Ok(blocks) => mutate_state(|state| process_blocks(blocks, from_block_index, state)),
            Err(error) => error!(?error, "Failed to get blocks from ledger"),
        }
    }

    fn process_blocks(blocks: Vec<CandidBlock>, from_block_index: BlockIndex, runtime_state: &mut RuntimeState) {
        let deposits = extract_deposits(blocks, from_block_index, runtime_state);

        for deposit in deposits {
            runtime_state.data.notifications_queue.add(deposit);
        }
    }

    fn extract_deposits(
        blocks: Vec<CandidBlock>,
        from_block_index: BlockIndex,
        runtime_state: &RuntimeState,
    ) -> Vec<DepositNotification> {
        let mut deposits = Vec::new();

        for (block_index, block) in blocks
            .into_iter()
            .enumerate()
            .map(|(index, block)| ((index as u64) + from_block_index, block))
        {
            if let CandidOperation::Transfer { from, to, amount, fee } = block.transaction.operation {
                if let Some(canister_id) = runtime_state.data.accounts.get_canister_id(&to) {
                    if runtime_state.data.accounts.get_canister_id(&from).is_none() {
                        deposits.push(DepositNotification {
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
                }
            }
        }

        deposits
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
