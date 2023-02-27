use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use types::{ChatId, Milliseconds, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct SetUserSuspendedQueue {
    queue: BTreeMap<TimestampMillis, VecDeque<SetUserSuspendedType>>,
}

#[derive(Serialize, Deserialize)]
pub enum SetUserSuspendedType {
    User(SetUserSuspended),
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

#[derive(Serialize, Deserialize)]
pub struct SetUserSuspended {
    pub user_id: UserId,
    pub duration: Option<Milliseconds>,
    pub reason: String,
    pub suspended_by: UserId,
}

impl SetUserSuspendedQueue {
    pub fn take_next_due(&mut self, now: TimestampMillis) -> Option<SetUserSuspendedType> {
        let (&key, queue) = self.queue.iter_mut().next().filter(|(&k, _)| k < now)?;
        let next = queue.pop_front();
        if queue.is_empty() {
            self.queue.remove(&key);
        }
        next
    }

    pub fn enqueue(&mut self, values: Vec<SetUserSuspendedType>) {
        self.enqueue_internal(values, 0);
    }

    pub fn schedule(&mut self, values: Vec<SetUserSuspendedType>, due: TimestampMillis) {
        self.enqueue_internal(values, due);
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    fn enqueue_internal(&mut self, values: Vec<SetUserSuspendedType>, due: TimestampMillis) {
        self.queue.entry(due).or_default().extend(values);
    }
}
