use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{TimestampMillis, UserId};

// Temporary: a snapshot of each user's last online date, which a one-off job fetched from the
// OnlineUsers canister on 30 September 2026, so that we can migrate the users who haven't signed in
// for the longest first. It is empty wherever that job didn't run.
// Users who registered after the snapshot was taken aren't in the map, and the map isn't updated
// when users are deleted, so always look users up in the `UserMap` first.
// TODO remove once the users have been migrated
#[derive(Serialize, Deserialize, Default)]
pub struct UsersLastOnline {
    // `None` means the OnlineUsers canister had no last online date for the user
    last_online: HashMap<UserId, Option<TimestampMillis>>,
    not_found: usize,
}

impl UsersLastOnline {
    // The users who have been offline the longest first, with users who have no last online date
    // (since they haven't been online since the OnlineUsers canister started tracking them) before
    // all others. Only users for which `filter` returns true are included
    pub fn longest_offline(&self, count: usize, filter: impl Fn(&UserId) -> bool) -> Vec<UserId> {
        let mut users: Vec<_> = self
            .last_online
            .iter()
            .filter(|(user_id, _)| filter(user_id))
            .map(|(user_id, last_online)| (last_online.unwrap_or_default(), *user_id))
            .collect();

        if users.len() > count {
            users.select_nth_unstable(count);
            users.truncate(count);
        }
        users.sort_unstable();
        users.into_iter().map(|(_, user_id)| user_id).collect()
    }

    pub fn metrics(&self) -> UsersLastOnlineMetrics {
        UsersLastOnlineMetrics {
            found: self.last_online.len() - self.not_found,
            not_found: self.not_found,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct UsersLastOnlineMetrics {
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
    fn longest_offline_users_come_first() {
        let users_last_online = UsersLastOnline {
            last_online: HashMap::from([
                (user_id(1), Some(300)),
                (user_id(2), Some(100)),
                (user_id(3), None),
                (user_id(4), Some(200)),
                (user_id(5), Some(50)),
            ]),
            not_found: 1,
        };

        // User 3 has no last online date, so comes first
        assert_eq!(
            users_last_online.longest_offline(3, |_| true),
            vec![user_id(3), user_id(5), user_id(2)]
        );
        assert_eq!(
            users_last_online.longest_offline(3, |u| *u != user_id(5)),
            vec![user_id(3), user_id(2), user_id(4)]
        );
        assert_eq!(users_last_online.longest_offline(10, |_| true).len(), 5);
    }
}
