use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use types::{CanisterId, TimestampMillis, UserId};

// The users in canisters of their own which the UserIndex has asked this LocalUserIndex to start
// migrating to MultiUser canisters
#[derive(Serialize, Deserialize, Default)]
pub struct UsersToMigrate {
    pending: VecDeque<UserToMigrate>,
    in_progress: HashSet<UserId>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct UserToMigrate {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
    pub attempt: u32,
    // Set when retrying, so that the user isn't retried straight away
    pub not_before: TimestampMillis,
}

impl UsersToMigrate {
    // Returns false if the user is already pending or in progress
    pub fn push(&mut self, user: UserToMigrate) -> bool {
        if self.in_progress.contains(&user.user_id) || self.pending.iter().any(|u| u.user_id == user.user_id) {
            false
        } else {
            self.pending.push_back(user);
            true
        }
    }

    // Takes the pending users which are due, until `max_in_progress` are in progress
    pub fn take_next_batch(&mut self, max_in_progress: usize, now: TimestampMillis) -> Vec<UserToMigrate> {
        let mut batch = Vec::new();
        while self.in_progress.len() < max_in_progress {
            let Some(index) = self.pending.iter().position(|u| u.not_before <= now) else {
                break;
            };
            let user = self.pending.remove(index).unwrap();
            self.in_progress.insert(user.user_id);
            batch.push(user);
        }
        batch
    }

    // When the next pending user is due, if fewer than `max_in_progress` are in progress
    pub fn next_due(&self, max_in_progress: usize) -> Option<TimestampMillis> {
        if self.in_progress.len() < max_in_progress {
            self.pending.iter().map(|u| u.not_before).min()
        } else {
            None
        }
    }

    pub fn mark_complete(&mut self, user_id: &UserId) {
        self.in_progress.remove(user_id);
    }

    pub fn pending(&self) -> usize {
        self.pending.len()
    }

    pub fn in_progress(&self) -> usize {
        self.in_progress.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user(i: u8) -> UserToMigrate {
        UserToMigrate {
            user_id: Principal::from_slice(&[i]).into(),
            multi_user_canister_id: Principal::from_slice(&[10]),
            attempt: 0,
            not_before: 0,
        }
    }

    #[test]
    fn users_already_pending_or_in_progress_are_ignored() {
        let mut users = UsersToMigrate::default();
        assert!(users.push(user(1)));
        assert!(!users.push(user(1)));

        assert_eq!(users.take_next_batch(10, 0), vec![user(1)]);
        assert!(!users.push(user(1)));

        users.mark_complete(&user(1).user_id);
        assert!(users.push(user(1)));
    }

    #[test]
    fn batches_are_limited_by_those_in_progress() {
        let mut users = UsersToMigrate::default();
        for i in 1..=5 {
            users.push(user(i));
        }

        assert_eq!(users.take_next_batch(2, 0), vec![user(1), user(2)]);
        assert!(users.take_next_batch(2, 0).is_empty());

        users.mark_complete(&user(1).user_id);
        assert_eq!(users.take_next_batch(2, 0), vec![user(3)]);
        assert_eq!(users.pending(), 2);
        assert_eq!(users.in_progress(), 2);
    }

    #[test]
    fn users_are_not_taken_before_they_are_due() {
        let mut users = UsersToMigrate::default();
        users.push(UserToMigrate {
            not_before: 100,
            ..user(1)
        });
        users.push(user(2));

        assert_eq!(users.next_due(10), Some(0));
        assert_eq!(users.take_next_batch(10, 50), vec![user(2)]);
        assert_eq!(users.next_due(10), Some(100));
        assert_eq!(users.next_due(1), None);

        users.mark_complete(&user(2).user_id);
        assert_eq!(
            users.take_next_batch(10, 100),
            vec![UserToMigrate {
                not_before: 100,
                ..user(1)
            }]
        );
        assert_eq!(users.next_due(10), None);
    }
}
