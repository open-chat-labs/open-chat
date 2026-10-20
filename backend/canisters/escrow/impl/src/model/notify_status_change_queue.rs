use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

// The swaps waiting for their status change to be sent, as versions before the event queue kept them.
// Only deserialized from their state and drained by the post_upgrade one-off, then removed.
#[derive(Serialize, Deserialize, Default)]
pub struct NotifyStatusChangeQueue {
    swaps: VecDeque<u32>,
}

impl NotifyStatusChangeQueue {
    pub fn pop(&mut self) -> Option<u32> {
        self.swaps.pop_front()
    }
}
