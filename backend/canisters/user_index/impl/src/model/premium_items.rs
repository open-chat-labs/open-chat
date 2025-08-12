use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PremiumItems {
    items: BTreeMap<u32, PremiumItem>,
    purchase_log: Vec<PremiumItemPurchase>,
}

#[derive(Serialize, Deserialize)]
struct PremiumItem {
    added: TimestampMillis,
    added_by: UserId,
    chit_cost: u32,
    last_updated: TimestampMillis,
    updated_by: UserId,
    purchase_count: u32,
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
        self.items.entry(item_id).and_modify(|i| i.purchase_count += 1);
    }

    pub fn set_chit_cost(&mut self, item_id: u32, cost: u32, user_id: UserId, now: TimestampMillis) {
        self.items
            .entry(item_id)
            .and_modify(|i| {
                i.chit_cost = cost;
                i.last_updated = now;
                i.updated_by = user_id;
            })
            .or_insert(PremiumItem {
                added: now,
                added_by: user_id,
                chit_cost: cost,
                last_updated: now,
                updated_by: user_id,
                purchase_count: 0,
            });
    }

    pub fn chit_costs(&self) -> impl Iterator<Item = (u32, u32)> {
        self.items.iter().map(|(item_id, item)| (*item_id, item.chit_cost))
    }

    pub fn metrics(&self) -> PremiumItemMetrics {
        PremiumItemMetrics {
            purchase_counts: self.items.iter().map(|(id, i)| (*id, i.purchase_count)).collect(),
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
