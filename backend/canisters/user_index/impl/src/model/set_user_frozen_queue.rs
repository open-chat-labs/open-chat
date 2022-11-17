use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use types::{ChatId, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct SetUserFrozenQueue {
    queue: BTreeMap<TimestampMillis, VecDeque<SetUserFrozen>>,
}

#[derive(Serialize, Deserialize)]
pub enum SetUserFrozen {
    Group(SetUserFrozenInGroup),
    Unfreeze(UserId),
}

#[derive(Serialize, Deserialize)]
pub struct SetUserFrozenInGroup {
    pub user_id: UserId,
    pub group: ChatId,
    pub frozen: bool,
    pub attempt: usize,
}

impl SetUserFrozenQueue {
    pub fn take_next_due(&mut self, now: TimestampMillis) -> Option<SetUserFrozen> {
        let (&key, queue) = self.queue.iter_mut().next().filter(|(&k, _)| k < now)?;
        let next = queue.pop_front();
        if queue.is_empty() {
            self.queue.remove(&key);
        }
        next
    }

    pub fn enqueue(&mut self, values: Vec<SetUserFrozen>) {
        self.enqueue_internal(values, 0);
    }

    pub fn schedule(&mut self, values: Vec<SetUserFrozen>, due: TimestampMillis) {
        self.enqueue_internal(values, due);
    }

    fn enqueue_internal(&mut self, values: Vec<SetUserFrozen>, due: TimestampMillis) {
        self.queue.entry(due).or_default().extend(values);
    }
}
