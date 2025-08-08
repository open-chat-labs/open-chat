use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::collections::btree_map::Entry::Vacant;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct PremiumItems {
    items: BTreeMap<u32, PremiumItem>,
    last_updated: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
struct PremiumItem {
    timestamp: TimestampMillis,
    paid_in_chat: bool,
    cost: u32,
}

impl PremiumItems {
    pub fn item_ids(&self) -> Vec<u32> {
        self.items.keys().copied().collect()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn add(&mut self, item_id: u32, cost: u32, now: TimestampMillis) -> bool {
        if let Vacant(e) = self.items.entry(item_id) {
            e.insert(PremiumItem {
                timestamp: now,
                paid_in_chat: false,
                cost,
            });
            true
        } else {
            false
        }
    }
}
