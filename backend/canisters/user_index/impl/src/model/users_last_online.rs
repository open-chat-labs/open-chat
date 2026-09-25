use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use types::{TimestampMillis, UserId};

// Temporary: a snapshot of each user's last online date, fetched once from the OnlineUsers canister
// so that we can migrate the users who haven't signed in for the longest first.
// TODO remove once the users have been migrated
#[derive(Serialize, Deserialize, Default)]
pub struct UsersLastOnline {
    started: bool,
    pending: VecDeque<UserId>,
    last_online: HashMap<UserId, TimestampMillis>,
    // Users the OnlineUsers canister has no last online date for
    not_found: usize,
}

impl UsersLastOnline {
    pub fn start_if_required(&mut self, user_ids: impl Iterator<Item = UserId>) {
        if !self.started {
            self.started = true;
            self.pending = user_ids.collect();
        }
    }

    pub fn is_complete(&self) -> bool {
        self.started && self.pending.is_empty()
    }

    pub fn take_next_batch(&mut self, max_size: usize) -> Vec<UserId> {
        let count = max_size.min(self.pending.len());
        self.pending.drain(..count).collect()
    }

    pub fn return_batch(&mut self, user_ids: Vec<UserId>) {
        for user_id in user_ids.into_iter().rev() {
            self.pending.push_front(user_id);
        }
    }

    pub fn record_batch(&mut self, requested: usize, results: impl Iterator<Item = (UserId, TimestampMillis)>) {
        let mut found = 0;
        for (user_id, last_online) in results {
            self.last_online.insert(user_id, last_online);
            found += 1;
        }
        self.not_found += requested.saturating_sub(found);
    }

    pub fn metrics(&self) -> UsersLastOnlineMetrics {
        UsersLastOnlineMetrics {
            started: self.started,
            pending: self.pending.len(),
            found: self.last_online.len(),
            not_found: self.not_found,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct UsersLastOnlineMetrics {
    pub started: bool,
    pub pending: usize,
    pub found: usize,
    pub not_found: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn batches_are_taken_returned_and_recorded() {
        let mut users_last_online = UsersLastOnline::default();
        assert!(!users_last_online.is_complete());

        users_last_online.start_if_required((1..=5).map(user_id));
        // Starting again is a no-op
        users_last_online.start_if_required((6..=10).map(user_id));

        let batch = users_last_online.take_next_batch(3);
        assert_eq!(batch, (1..=3).map(user_id).collect::<Vec<_>>());

        // A failed batch goes back to the front of the queue, in order
        users_last_online.return_batch(batch);
        let batch = users_last_online.take_next_batch(3);
        assert_eq!(batch, (1..=3).map(user_id).collect::<Vec<_>>());

        users_last_online.record_batch(batch.len(), [(user_id(1), 100), (user_id(3), 300)].into_iter());
        assert!(!users_last_online.is_complete());

        let batch = users_last_online.take_next_batch(3);
        assert_eq!(batch, (4..=5).map(user_id).collect::<Vec<_>>());
        users_last_online.record_batch(batch.len(), [(user_id(5), 500)].into_iter());
        assert!(users_last_online.is_complete());

        let metrics = users_last_online.metrics();
        assert_eq!(metrics.pending, 0);
        assert_eq!(metrics.found, 3);
        assert_eq!(metrics.not_found, 2);
        assert_eq!(users_last_online.last_online.get(&user_id(3)), Some(&300));
    }
}
