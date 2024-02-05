use serde::{Deserialize, Serialize};
use std::mem;
use storage_index_canister::add_or_update_users::UserConfig;

const MAX_USERS_PER_BATCH: usize = 1000;

#[derive(Serialize, Deserialize, Default)]
pub struct OpenStorageUserSyncQueue {
    users: Vec<UserConfig>,
    sync_in_progress: bool,
    // If any batches fail, retry that batch rather than taking new users.
    // This ensures that updates are always synced in order.
    users_to_retry: Option<Vec<UserConfig>>,
}

impl OpenStorageUserSyncQueue {
    pub fn push(&mut self, user: UserConfig) {
        self.users.push(user);
    }

    pub fn try_start_sync(&mut self) -> Option<Vec<UserConfig>> {
        if self.sync_in_progress {
            None
        } else if let Some(users) = self.users_to_retry.take() {
            self.sync_in_progress = true;
            Some(users)
        } else if self.users.is_empty() {
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

    pub fn mark_sync_failed(&mut self, users: Vec<UserConfig>) {
        self.users_to_retry = Some(users);
        self.sync_in_progress = false;
    }

    pub fn is_empty(&self) -> bool {
        self.users.is_empty()
    }
}
