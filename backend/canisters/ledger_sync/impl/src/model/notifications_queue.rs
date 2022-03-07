use ic_ledger_types::{AccountIdentifier, BlockIndex, Tokens};
use std::collections::VecDeque;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct NotificationsQueue {
    queue: VecDeque<TransferNotification>,
}

impl NotificationsQueue {
    pub fn add(&mut self, notification: TransferNotification) {
        self.queue.push_back(notification);
    }

    pub fn take(&mut self) -> Option<TransferNotification> {
        self.queue.pop_front()
    }
}

#[derive(Serialize, Deserialize)]
pub struct TransferNotification {
    pub canister_id: CanisterId,
    pub from: AccountIdentifier,
    pub to: AccountIdentifier,
    pub account: Tokens,
    pub block_index: BlockIndex,
    pub timestamp: TimestampMillis,
}
