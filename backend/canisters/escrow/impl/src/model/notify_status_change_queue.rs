use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Serialize, Deserialize, Default)]
pub struct NotifyStatusChangeQueue {
    swaps: VecDeque<u32>,
}

impl NotifyStatusChangeQueue {
    pub fn push(&mut self, swap_id: u32) {
        self.swaps.push_back(swap_id);
    }

    pub fn pop(&mut self) -> Option<u32> {
        self.swaps.pop_front()
    }

    pub fn len(&self) -> usize {
        self.swaps.len()
    }

    pub fn is_empty(&self) -> bool {
        self.swaps.is_empty()
    }
}
