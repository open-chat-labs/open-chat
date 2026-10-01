use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{CanisterId, Milliseconds, TimestampMillis, UserId};

// Longer than a migration takes, since the UserIndex cancels one after an hour without progress
const RETENTION: Milliseconds = 3 * HOUR_IN_MS;
const PRUNE_INTERVAL: Milliseconds = 10 * MINUTE_IN_MS;

// The groups and communities which users have recently joined via this LocalUserIndex. A user who
// joins one while being migrated to a MultiUser canister is added under their old id, after their
// old canister has been exported, so it isn't among those the migration tells of their new id. So
// once this LocalUserIndex hears of the migration, it tells those too.
#[derive(Serialize, Deserialize, Default)]
pub struct RecentJoins {
    joins: BTreeMap<(UserId, CanisterId), TimestampMillis>,
    last_pruned: TimestampMillis,
}

impl RecentJoins {
    pub fn push(&mut self, user_id: UserId, canister_id: CanisterId, now: TimestampMillis) {
        if now.saturating_sub(self.last_pruned) >= PRUNE_INTERVAL {
            self.joins.retain(|_, joined| !expired(*joined, now));
            self.last_pruned = now;
        }
        self.joins.insert((user_id, canister_id), now);
    }

    // The groups and communities the user has recently joined
    pub fn joined_by(&self, user_id: UserId, now: TimestampMillis) -> Vec<CanisterId> {
        self.joins
            .range((user_id, CanisterId::from_slice(&[]))..)
            .take_while(|((u, _), _)| *u == user_id)
            .filter(|(_, joined)| !expired(**joined, now))
            .map(|((_, canister_id), _)| *canister_id)
            .collect()
    }

    pub fn len(&self) -> usize {
        self.joins.len()
    }
}

fn expired(joined: TimestampMillis, now: TimestampMillis) -> bool {
    now.saturating_sub(joined) > RETENTION
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn id(i: u8) -> Principal {
        Principal::from_slice(&[i])
    }

    #[test]
    fn joins_are_found_by_user_until_they_expire() {
        let mut joins = RecentJoins::default();
        let [user1, user2]: [UserId; 2] = [id(1).into(), id(2).into()];
        let [group, community, other] = [id(10), id(11), id(12)];

        joins.push(user1, group, 0);
        joins.push(user2, other, 0);
        joins.push(user1, community, HOUR_IN_MS);

        assert_eq!(joins.joined_by(user1, HOUR_IN_MS), vec![group, community]);
        assert_eq!(joins.joined_by(user2, HOUR_IN_MS), vec![other]);
        assert!(joins.joined_by(id(3).into(), HOUR_IN_MS).is_empty());

        // The earliest joins expire first
        assert_eq!(joins.joined_by(user1, RETENTION + 1), vec![community]);
        assert!(joins.joined_by(user2, RETENTION + 1).is_empty());

        // And are pruned on the next join after a while
        joins.push(user2, other, RETENTION + PRUNE_INTERVAL);
        assert_eq!(joins.len(), 2);
    }
}
