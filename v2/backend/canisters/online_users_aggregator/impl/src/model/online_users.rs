use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{Milliseconds, TimestampMillis};

const SYNC_AFTER_INTERVAL: Milliseconds = 5 * 1000; // 5 seconds
const SYNC_IF_COUNT_EXCEEDED: usize = 200;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct OnlineUsers {
    users: HashSet<Principal>,
    last_synced: TimestampMillis,
}

impl OnlineUsers {
    pub fn push(&mut self, caller: Principal) {
        self.users.insert(caller);
    }

    pub fn take_if_due_for_sync(&mut self, now: TimestampMillis) -> Option<Vec<Principal>> {
        if self.is_due_for_sync(now) {
            let users = std::mem::take(&mut self.users);
            Some(users.into_iter().collect())
        } else {
            None
        }
    }

    fn is_due_for_sync(&self, now: TimestampMillis) -> bool {
        if self.users.is_empty() {
            return false;
        }

        now.saturating_sub(self.last_synced) >= SYNC_AFTER_INTERVAL || self.users.len() >= SYNC_IF_COUNT_EXCEEDED
    }
}
