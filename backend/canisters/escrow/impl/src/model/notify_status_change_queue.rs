use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Serialize, Deserialize, Default)]
pub struct NotifyStatusChangeQueue {
    offers: VecDeque<u32>,
}

impl NotifyStatusChangeQueue {
    pub fn push(&mut self, offer_id: u32) {
        self.offers.push_back(offer_id);
    }

    pub fn pop(&mut self) -> Option<u32> {
        self.offers.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.offers.is_empty()
    }
}
