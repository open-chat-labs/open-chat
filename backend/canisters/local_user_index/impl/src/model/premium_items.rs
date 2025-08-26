use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Serialize, Deserialize, Default)]
pub struct PremiumItems {
    items: BTreeMap<u32, PremiumItem>,
}

#[derive(Serialize, Deserialize)]
struct PremiumItem {
    chit_cost: u32,
}

impl PremiumItems {
    pub fn set(&mut self, item_id: u32, chit_cost: u32) {
        self.items.insert(item_id, PremiumItem { chit_cost });
    }

    pub fn chit_cost(&self, item_id: &u32) -> Option<u32> {
        self.items.get(item_id).map(|item| item.chit_cost)
    }
}
