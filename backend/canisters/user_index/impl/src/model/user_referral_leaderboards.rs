use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::binary_heap::BinaryHeap;
use std::collections::btree_map::BTreeMap;
use std::collections::HashMap;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserReferralLeaderboards {
    per_month: BTreeMap<MonthKey, UserReferralLeaderboard>,
    all_time: UserReferralLeaderboard,
}

impl UserReferralLeaderboards {
    pub fn add_referral(&mut self, user_id: UserId, now: TimestampMillis) {
        self.per_month
            .entry(MonthKey::from_timestamp(now))
            .or_default()
            .add_referral(user_id);

        self.all_time.add_referral(user_id);
    }

    pub fn add_reward(&mut self, user_id: UserId, new_diamond_member: bool, reward_e8s: u64, now: TimestampMillis) {
        self.per_month
            .entry(MonthKey::from_timestamp(now))
            .or_default()
            .add_reward(user_id, new_diamond_member, reward_e8s);

        self.all_time.add_reward(user_id, new_diamond_member, reward_e8s);
    }

    pub fn top_all_time(&self, count: usize) -> Vec<ReferralStats> {
        self.all_time.top(count)
    }

    pub fn top_for_month(&self, month: MonthKey, count: usize) -> Vec<ReferralStats> {
        self.per_month.get(&month).map(|lb| lb.top(count)).unwrap_or_default()
    }
}

#[derive(Serialize, Deserialize, Default)]
struct UserReferralLeaderboard {
    users: HashMap<UserId, ReferralStatsInternal>,
}

impl UserReferralLeaderboard {
    fn add_referral(&mut self, user_id: UserId) {
        self.users.entry(user_id).or_default().total_users += 1;
    }

    fn add_reward(&mut self, user_id: UserId, new_diamond_member: bool, reward_e8s: u64) {
        let mut stats = self.users.entry(user_id).or_default();
        if new_diamond_member {
            stats.diamond_members += 1;
        }
        stats.total_rewards_e8s += reward_e8s;
    }

    fn top(&self, count: usize) -> Vec<ReferralStats> {
        let mut top: BinaryHeap<Reverse<ReferralStats>> = BinaryHeap::with_capacity(count);

        for stats in self.users.iter().map(|(u, s)| ReferralStats {
            total_rewards_e8s: s.total_rewards_e8s,
            diamond_members: s.diamond_members,
            total_users: s.total_users,
            user_id: *u,
        }) {
            if let Some(current) = top.peek() {
                if top.len() == count {
                    if current.0.gt(&stats) {
                        continue;
                    }
                    top.pop();
                }
            }

            top.push(Reverse(stats));
        }

        let mut vec = Vec::new();
        while let Some(next) = top.pop() {
            vec.push(next.0);
        }
        vec.reverse();
        vec
    }
}

#[derive(Serialize, Deserialize, Default)]
struct ReferralStatsInternal {
    total_rewards_e8s: u64,
    diamond_members: u32,
    total_users: u32,
}

#[derive(Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq)]
pub struct ReferralStats {
    pub total_rewards_e8s: u64,
    pub diamond_members: u32,
    pub total_users: u32,
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Eq, PartialEq, Ord, PartialOrd)]
pub struct MonthKey {
    year: u32,
    month: u32,
}

impl MonthKey {
    pub fn new(year: u32, month: u32) -> MonthKey {
        MonthKey { year, month }
    }

    pub fn from_timestamp(ts: TimestampMillis) -> MonthKey {
        let date = time::OffsetDateTime::from_unix_timestamp((ts / 1000) as i64).unwrap();

        MonthKey {
            year: date.year() as u32,
            month: u8::from(date.month()) as u32,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::CanisterId;

    #[test]
    fn top() {
        let user1 = UserId::new(CanisterId::from_slice(&[1]));
        let user2 = UserId::new(CanisterId::from_slice(&[2]));
        let user3 = UserId::new(CanisterId::from_slice(&[3]));
        let user4 = UserId::new(CanisterId::from_slice(&[4]));
        let user5 = UserId::new(CanisterId::from_slice(&[5]));

        let mut leaderboard = UserReferralLeaderboard::default();

        leaderboard.add_referral(user1);
        leaderboard.add_referral(user2);
        leaderboard.add_referral(user2);
        leaderboard.add_reward(user3, false, 10);
        leaderboard.add_reward(user4, true, 10);
        leaderboard.add_reward(user5, true, 20);

        let top3 = leaderboard.top(3);
        assert_eq!(
            top3.into_iter().map(|s| s.user_id).collect::<Vec<_>>(),
            vec![user5, user4, user3]
        );

        let top5 = leaderboard.top(5);
        assert_eq!(
            top5.into_iter().map(|s| s.user_id).collect::<Vec<_>>(),
            vec![user5, user4, user3, user2, user1]
        );
    }
}
