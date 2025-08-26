use serde::{Deserialize, Serialize};
use std::{cmp::Reverse, mem};
use types::{TimestampMillis, UserId};
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Clone)]
pub struct ChitLeaderboard {
    all_time: Vec<ChitUserBalance>,
    this_month: Vec<ChitUserBalance>,
    last_month: Vec<ChitUserBalance>,
    this_month_key: MonthKey,
}

#[derive(Serialize, Deserialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct ChitUserBalance {
    pub balance: u32,
    pub user_id: UserId,
}

pub const MAX_LEADERS: usize = 50;

impl ChitLeaderboard {
    pub fn new(now: TimestampMillis) -> ChitLeaderboard {
        ChitLeaderboard {
            all_time: Vec::new(),
            this_month: Vec::new(),
            last_month: Vec::new(),
            this_month_key: MonthKey::from_timestamp(now),
        }
    }

    pub fn switch_months(&mut self, now: TimestampMillis) {
        let mk = MonthKey::from_timestamp(now);

        if mk == self.this_month_key.next() {
            self.last_month = mem::take(&mut self.this_month);
            self.this_month_key = mk;
        }
    }

    pub fn update_position(
        &mut self,
        user_id: UserId,
        total_balance: i32,
        curr_balance: i32,
        updated: TimestampMillis,
        now: TimestampMillis,
    ) {
        self.switch_months(now);

        let updated_mk = MonthKey::from_timestamp(updated);

        if updated_mk == self.this_month_key {
            ChitLeaderboard::update_leaderboard(&mut self.this_month, user_id, curr_balance);
        } else if updated_mk == self.this_month_key.previous() {
            ChitLeaderboard::update_leaderboard(&mut self.last_month, user_id, curr_balance);
        }

        ChitLeaderboard::update_leaderboard(&mut self.all_time, user_id, total_balance);
    }

    fn update_leaderboard(leaderboard: &mut Vec<ChitUserBalance>, user_id: UserId, chit: i32) {
        if chit <= 0 {
            leaderboard.retain(|i| i.user_id != user_id);
            return;
        }

        let full = leaderboard.len() >= MAX_LEADERS;
        let chit = chit as u32;

        if let Some(last) = leaderboard.last()
            && full
            && chit <= last.balance
        {
            return;
        }

        if let Some(my) = leaderboard.iter_mut().find(|i| i.user_id == user_id) {
            my.balance = chit;
        } else {
            if full {
                leaderboard.pop();
            }

            leaderboard.push(ChitUserBalance { user_id, balance: chit });
        }

        leaderboard.sort_unstable_by_key(|i| Reverse(i.balance));
    }

    pub fn all_time(&self) -> &[ChitUserBalance] {
        &self.all_time
    }

    pub fn this_month(&self) -> &[ChitUserBalance] {
        &self.this_month
    }

    pub fn last_month(&self) -> &[ChitUserBalance] {
        &self.last_month
    }
}

#[cfg(test)]
mod tests {
    use rand::RngCore;
    use testing::rng::random_principal;

    use super::*;

    #[test]
    fn leaderboard_in_expected_order() {
        let mut leaderboard = ChitLeaderboard::new(0);
        leaderboard.update_position(rnd_user(), 100, 10, 1, 1);
        leaderboard.update_position(rnd_user(), 400, 10, 1, 1);
        leaderboard.update_position(rnd_user(), 200, 10, 1, 1);

        let leaders = leaderboard.all_time();

        assert_eq!(leaders.len(), 3);
        assert_eq!(leaders[0].balance, 400);
        assert_eq!(leaders[1].balance, 200);
        assert_eq!(leaders[2].balance, 100);
    }

    #[test]
    fn max_leaders_not_exceeded() {
        let mut leaderboard = ChitLeaderboard::new(0);

        for _ in 0..(2 * MAX_LEADERS) {
            leaderboard.update_position(rnd_user(), rnd_balance(), 10, 1, 1);
        }

        let leaders = leaderboard.all_time();

        assert_eq!(leaders.len(), MAX_LEADERS);
    }

    #[test]
    fn update_same_user_handled_correctly() {
        let mut leaderboard = ChitLeaderboard::new(0);
        let me = rnd_user();

        leaderboard.update_position(me, 100, 10, 1, 1);
        leaderboard.update_position(me, 400, 10, 1, 1);

        let leaders = leaderboard.all_time();

        assert_eq!(leaders.len(), 1);
        assert_eq!(leaders[0].balance, 400);
    }

    fn rnd_user() -> UserId {
        UserId::from(random_principal())
    }

    fn rnd_balance() -> i32 {
        (rand::thread_rng().next_u32() % 1000) as i32
    }
}
