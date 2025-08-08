use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PremiumItems {
    purchase_log: Vec<PremiumItemPurchase>,
    purchase_counts: BTreeMap<u32, u32>,
}

impl PremiumItems {
    pub fn log_purchase(&mut self, user_id: UserId, item_id: u32, paid_in_chat: bool, cost: u32, timestamp: TimestampMillis) {
        self.purchase_log.push(PremiumItemPurchase {
            timestamp,
            user_id,
            item_id,
            paid_in_chat,
            cost,
        });
        *self.purchase_counts.entry(item_id).or_default() += 1;
    }

    pub fn metrics(&self) -> PremiumItemMetrics {
        PremiumItemMetrics {
            purchase_counts: self.purchase_counts.clone(),
            latest_purchase: self.purchase_log.last().map(|l| l.timestamp).unwrap_or_default(),
        }
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

#[derive(Serialize, Debug)]
pub struct PremiumItemMetrics {
    purchase_counts: BTreeMap<u32, u32>,
    latest_purchase: TimestampMillis,
}
