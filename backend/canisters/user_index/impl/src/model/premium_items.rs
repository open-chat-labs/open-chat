use serde::{Deserialize, Serialize};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PremiumItems {
    purchase_log: Vec<PremiumItemPurchase>,
}

impl PremiumItems {
    pub fn cost_in_chit(item_id: u32) -> Option<u32> {
        match item_id {
            1 => Some(10_000),
            _ => None,
        }
    }

    pub fn log_purchase(&mut self, user_id: UserId, item_id: u32, paid_in_chat: bool, cost: u32, now: TimestampMillis) {
        self.purchase_log.push(PremiumItemPurchase {
            timestamp: now,
            user_id,
            item_id,
            paid_in_chat,
            cost,
        })
    }
}

#[derive(Serialize, Deserialize)]
struct PremiumItemPurchase {
    timestamp: TimestampMillis,
    user_id: UserId,
    item_id: u32,
    paid_in_chat: bool,
    cost: u32,
}
