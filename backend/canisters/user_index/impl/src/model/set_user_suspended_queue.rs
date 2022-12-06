use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use types::{ChatId, Milliseconds, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct SetUserSuspendedQueue {
    queue: BTreeMap<TimestampMillis, VecDeque<SetUserSuspended>>,
}

#[derive(Serialize, Deserialize)]
pub enum SetUserSuspended {
    User(UserId, Option<Milliseconds>),
    Group(SetUserSuspendedInGroup),
    Unsuspend(UserId),
}

#[derive(Serialize, Deserialize)]
pub struct SetUserSuspendedInGroup {
    pub user_id: UserId,
    pub group: ChatId,
    pub suspended: bool,
    pub attempt: usize,
}

impl SetUserSuspendedQueue {
    pub fn take_next_due(&mut self, now: TimestampMillis) -> Option<SetUserSuspended> {
        let (&key, queue) = self.queue.iter_mut().next().filter(|(&k, _)| k < now)?;
        let next = queue.pop_front();
        if queue.is_empty() {
            self.queue.remove(&key);
        }
        next
    }

    pub fn enqueue(&mut self, values: Vec<SetUserSuspended>) {
        self.enqueue_internal(values, 0);
    }

    pub fn schedule(&mut self, values: Vec<SetUserSuspended>, due: TimestampMillis) {
        self.enqueue_internal(values, due);
    }

    fn enqueue_internal(&mut self, values: Vec<SetUserSuspended>, due: TimestampMillis) {
        self.queue.entry(due).or_default().extend(values);
    }
}
