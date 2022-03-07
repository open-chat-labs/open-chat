use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{CanisterId, CryptocurrencyDeposit};

#[derive(Serialize, Deserialize, Default)]
pub struct NotificationsQueue {
    queue: VecDeque<DepositNotification>,
}

impl NotificationsQueue {
    pub fn add(&mut self, notification: DepositNotification) {
        self.queue.push_back(notification);
    }

    pub fn take(&mut self) -> Option<DepositNotification> {
        self.queue.pop_front()
    }
}

#[derive(Serialize, Deserialize)]
pub struct DepositNotification {
    pub canister_id: CanisterId,
    pub deposit: CryptocurrencyDeposit,
}
