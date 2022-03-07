use crate::model::notifications_queue::DepositNotification;
use crate::mutate_state;
use ic_cdk_macros::heartbeat;
use types::{CanisterId, CryptocurrencyDeposit};

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
        let block_index = get_latest_block_index().await;

        mutate_state(|state| state.data.ledger_sync_state.mark_complete(block_index));
    }

    async fn get_latest_block_index() -> u64 {
        todo!()
    }

    async fn sync_transactions(_from_block_index: u64) {
        todo!()
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
