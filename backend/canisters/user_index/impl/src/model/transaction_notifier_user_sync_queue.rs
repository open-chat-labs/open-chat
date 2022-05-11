use serde::{Deserialize, Serialize};
use std::mem;
use types::UserId;

const MAX_USERS_PER_BATCH: usize = 1000;

#[derive(Serialize, Deserialize, Default)]
pub struct TransactionNotifierUserSyncQueue {
    users: Vec<UserId>,
    sync_in_progress: bool,
}

impl TransactionNotifierUserSyncQueue {
    pub fn push(&mut self, user_id: UserId) {
        self.users.push(user_id);
    }

    pub fn try_start_sync(&mut self) -> Option<Vec<UserId>> {
        if self.sync_in_progress || self.users.is_empty() {
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

    pub fn mark_sync_failed(&mut self, user_ids: &[UserId]) {
        self.users.extend_from_slice(&user_ids);
        self.sync_in_progress = false;
    }
}
