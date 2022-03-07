use serde::{Deserialize, Serialize};
use std::mem;
use types::UserId;

const MAX_USERS_PER_BATCH: usize = 1000;

#[derive(Serialize, Deserialize, Default)]
pub struct LedgerSyncCanisterUserSyncQueue {
    users: Vec<UserId>,
    sync_in_progress: bool,
}

impl LedgerSyncCanisterUserSyncQueue {
    pub fn push(&mut self, user: UserId) {
        self.users.push(user);
    }

    pub fn try_start_sync(&mut self) -> Option<Vec<UserId>> {
        if self.users.is_empty() || self.sync_in_progress {
            None
        } else {
            self.sync_in_progress = true;
            let users = if self.users.len() <= MAX_USERS_PER_BATCH {
                mem::take(&mut self.users)
            } else {
                self.users.drain(..MAX_USERS_PER_BATCH).collect()
            };
            Some(users)
        }
    }

    pub fn mark_sync_completed(&mut self) {
        self.sync_in_progress = false;
    }
}
