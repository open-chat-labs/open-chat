use constants::DAY_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, VecDeque};
use types::{Milliseconds, TimestampMillis, UserId};

const YEAR_IN_MS: Milliseconds = 365 * DAY_IN_MS;

// Temporary: a snapshot of each user's last online date, fetched once from the OnlineUsers canister
// so that we can migrate the users who haven't signed in for the longest first.
// The user ids are snapshotted when the job starts, so users who register after that won't be in
// the map, and the map isn't updated when users are deleted, so always look users up in the
// `UserMap` first.
// TODO remove once the users have been migrated
#[derive(Serialize, Deserialize, Default)]
pub struct UsersLastOnline {
    started: bool,
    pending: VecDeque<UserId>,
    // `None` means the OnlineUsers canister has no last online date for the user
    last_online: HashMap<UserId, Option<TimestampMillis>>,
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

    pub fn record_batch(&mut self, requested: Vec<UserId>, results: impl Iterator<Item = (UserId, TimestampMillis)>) {
        let requested_count = requested.len();
        for user_id in requested {
            self.last_online.insert(user_id, None);
        }
        let mut found = 0;
        for (user_id, last_online) in results {
            self.last_online.insert(user_id, Some(last_online));
            found += 1;
        }
        self.not_found += requested_count.saturating_sub(found);
    }

    pub fn metrics(&self) -> UsersLastOnlineMetrics {
        UsersLastOnlineMetrics {
            started: self.started,
            pending: self.pending.len(),
            found: self.last_online.len() - self.not_found,
            not_found: self.not_found,
        }
    }

    // For each whole number of years N (from 1), the number of users last online at least N years ago.
    // Users with no last online date are excluded (they are counted in `not_found`)
    pub fn users_offline_for_years(&self, now: TimestampMillis) -> BTreeMap<u64, usize> {
        let mut by_years: BTreeMap<u64, usize> = BTreeMap::new();
        for years in self
            .last_online
            .values()
            .flatten()
            .map(|ts| now.saturating_sub(*ts) / YEAR_IN_MS)
            .filter(|years| *years > 0)
        {
            *by_years.entry(years).or_default() += 1;
        }

        let max_years = by_years.keys().last().copied().unwrap_or_default();
        let mut cumulative = BTreeMap::new();
        let mut total = 0;
        for years in (1..=max_years).rev() {
            total += by_years.get(&years).copied().unwrap_or_default();
            cumulative.insert(years, total);
        }
        cumulative
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

        users_last_online.record_batch(batch, [(user_id(1), 100), (user_id(3), 300)].into_iter());
        assert!(!users_last_online.is_complete());

        let batch = users_last_online.take_next_batch(3);
        assert_eq!(batch, (4..=5).map(user_id).collect::<Vec<_>>());
        users_last_online.record_batch(batch, [(user_id(5), 500)].into_iter());
        assert!(users_last_online.is_complete());

        let metrics = users_last_online.metrics();
        assert_eq!(metrics.pending, 0);
        assert_eq!(metrics.found, 3);
        assert_eq!(metrics.not_found, 2);
        assert_eq!(users_last_online.last_online.get(&user_id(2)), Some(&None));
        assert_eq!(users_last_online.last_online.get(&user_id(3)), Some(&Some(300)));
        assert_eq!(users_last_online.last_online.get(&user_id(6)), None);
    }

    #[test]
    fn users_offline_for_years_is_cumulative() {
        let now = 10 * YEAR_IN_MS;
        let mut users_last_online = UsersLastOnline::default();
        users_last_online.start_if_required((1..=6).map(user_id));
        let batch = users_last_online.take_next_batch(6);
        users_last_online.record_batch(
            batch,
            [
                (user_id(1), now - DAY_IN_MS),
                (user_id(2), now - YEAR_IN_MS),
                (user_id(3), now - YEAR_IN_MS - DAY_IN_MS),
                (user_id(4), now - 3 * YEAR_IN_MS),
                // user 5 has no last online date
                (user_id(6), now - 3 * YEAR_IN_MS - DAY_IN_MS),
            ]
            .into_iter(),
        );

        let result = users_last_online.users_offline_for_years(now);
        assert_eq!(result, BTreeMap::from([(1, 4), (2, 2), (3, 2)]));
    }
}
