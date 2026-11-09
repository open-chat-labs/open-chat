use constants::{DAY_IN_MS, MAX_PRIZE_CLAIMS_PER_DAY};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use types::{TimestampMillis, UserId};

// The prizes each user has claimed in the last 24 hours, which the LocalUserIndexes report
#[derive(Serialize, Deserialize, Default)]
pub struct PrizeClaims {
    by_user: HashMap<UserId, VecDeque<TimestampMillis>>,
    // Every claim in the order it was reported, so those over 24 hours old can be dropped
    claims: VecDeque<(UserId, TimestampMillis)>,
}

impl PrizeClaims {
    // Records a claim. If the user has now reached the limit, returns when they can claim again,
    // which is once enough of their claims are 24 hours old to take them back under it.
    pub fn record(&mut self, user_id: UserId, claimed_at: TimestampMillis, now: TimestampMillis) -> Option<TimestampMillis> {
        self.prune(now);
        self.claims.push_back((user_id, claimed_at));
        let user_claims = self.by_user.entry(user_id).or_default();
        user_claims.push_back(claimed_at);
        user_claims
            .len()
            .checked_sub(MAX_PRIZE_CLAIMS_PER_DAY)
            .map(|i| user_claims[i] + DAY_IN_MS)
    }

    pub fn count(&self) -> usize {
        self.claims.len()
    }

    fn prune(&mut self, now: TimestampMillis) {
        while let Some((user_id, claimed_at)) = self.claims.front().copied() {
            if claimed_at + DAY_IN_MS > now {
                break;
            }
            self.claims.pop_front();
            if let Some(user_claims) = self.by_user.get_mut(&user_id) {
                user_claims.pop_front();
                if user_claims.is_empty() {
                    self.by_user.remove(&user_id);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use constants::HOUR_IN_MS;

    fn user(i: u8) -> UserId {
        UserId::from(candid::Principal::from_slice(&[i]))
    }

    #[test]
    fn the_claim_which_reaches_the_limit_blocks_until_the_oldest_is_a_day_old() {
        let mut claims = PrizeClaims::default();
        let start = 10 * DAY_IN_MS;
        for i in 0..MAX_PRIZE_CLAIMS_PER_DAY as u64 - 1 {
            let now = start + i * HOUR_IN_MS;
            assert_eq!(claims.record(user(1), now, now), None);
        }
        let now = start + 20 * HOUR_IN_MS;
        assert_eq!(claims.record(user(1), now, now), Some(start + DAY_IN_MS));
    }

    #[test]
    fn claims_over_a_day_old_no_longer_count() {
        let mut claims = PrizeClaims::default();
        let start = 10 * DAY_IN_MS;
        for i in 0..MAX_PRIZE_CLAIMS_PER_DAY as u64 {
            claims.record(user(1), start + i, start + i);
        }
        assert_eq!(claims.count(), MAX_PRIZE_CLAIMS_PER_DAY);

        // A day after the first claim, it's dropped, so the next claim reaches the limit again and
        // blocks until the second is a day old
        let now = start + DAY_IN_MS;
        assert_eq!(claims.record(user(1), now, now), Some(start + 1 + DAY_IN_MS));
        assert_eq!(claims.count(), MAX_PRIZE_CLAIMS_PER_DAY);

        // A day after all of them, only the new claim counts
        let now = start + 2 * DAY_IN_MS;
        assert_eq!(claims.record(user(1), now, now), None);
        assert_eq!(claims.count(), 1);
    }

    #[test]
    fn claims_reported_after_the_limit_push_the_block_back() {
        let mut claims = PrizeClaims::default();
        let start = 10 * DAY_IN_MS;
        for i in 0..MAX_PRIZE_CLAIMS_PER_DAY as u64 {
            claims.record(user(1), start + i, start + i);
        }
        let now = start + HOUR_IN_MS;
        assert_eq!(claims.record(user(1), now, now), Some(start + 1 + DAY_IN_MS));
    }

    #[test]
    fn each_user_has_their_own_limit() {
        let mut claims = PrizeClaims::default();
        let start = 10 * DAY_IN_MS;
        for i in 0..MAX_PRIZE_CLAIMS_PER_DAY as u64 - 1 {
            claims.record(user(1), start + i, start + i);
            assert_eq!(claims.record(user(2), start + i, start + i), None);
        }
        assert!(claims.record(user(1), start + HOUR_IN_MS, start + HOUR_IN_MS).is_some());
        assert!(claims.record(user(2), start + HOUR_IN_MS, start + HOUR_IN_MS).is_some());
        assert_eq!(claims.record(user(3), start + HOUR_IN_MS, start + HOUR_IN_MS), None);
    }
}
