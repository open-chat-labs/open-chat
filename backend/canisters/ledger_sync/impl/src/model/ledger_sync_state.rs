use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
pub struct LedgerSyncState {
    in_progress: bool,
    block_index_synced_up_to: u64,
}

impl LedgerSyncState {
    pub fn try_start(&mut self) -> Option<u64> {
        if self.in_progress {
            None
        } else {
            self.in_progress = true;
            Some(self.block_index_synced_up_to)
        }
    }

    pub fn mark_complete(&mut self, block_index: u64) {
        self.in_progress = false;
        self.block_index_synced_up_to = block_index;
    }
}
