use ic_cdk_macros::heartbeat;

#[heartbeat]
fn heartbeat() {
    sync_ledger_transactions::run();
}

mod sync_ledger_transactions {
    use super::*;
    use crate::mutate_state;

    pub fn run() {
        match mutate_state(|state| state.data.ledger_sync_state.try_start()) {
            Some(0) => ic_cdk::spawn(init_block_index()),
            Some(block_index_synced_up_to) => ic_cdk::spawn(sync_transactions(block_index_synced_up_to + 1)),
            None => {}
        }
    }

    async fn init_block_index() {
        let block_index = 1;

        mutate_state(|state| state.data.ledger_sync_state.mark_complete(block_index));
    }

    async fn sync_transactions(from_block_index: u64) {
        let transactions = get_transactions(from_block_index).await;

        if !transactions.is_empty() {
            for transaction in transactions {}
        }
    }

    async fn get_transactions(from_block_index: u64) -> Vec {}
}
