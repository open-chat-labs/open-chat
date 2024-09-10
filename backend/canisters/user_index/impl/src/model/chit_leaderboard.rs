use serde::{Deserialize, Serialize};
use std::{cmp::Reverse, mem};
use types::UserId;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ChitLeaderboard {
    all_time: Vec<ChitUserBalance>,
    this_month: Vec<ChitUserBalance>,
    last_month: Vec<ChitUserBalance>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct ChitUserBalance {
    pub balance: u32,
    pub user_id: UserId,
}

const MAX_LEADERS: usize = 50;

impl ChitLeaderboard {
    pub fn reset_this_month(&mut self) {
        self.last_month = mem::take(&mut self.this_month);
    }

    pub fn initialize(
        &mut self,
        all_time: Vec<ChitUserBalance>,
        this_month: Vec<ChitUserBalance>,
        last_month: Vec<ChitUserBalance>,
    ) {
        self.all_time = all_time;
        self.this_month = this_month;
        self.last_month = last_month;
    }

    pub fn update_position(&mut self, user_id: UserId, total_balance: i32, curr_balance: i32) {
        ChitLeaderboard::update_leaderboard(&mut self.all_time, user_id, total_balance);
        ChitLeaderboard::update_leaderboard(&mut self.this_month, user_id, curr_balance);
    }

    fn update_leaderboard(leaderboard: &mut Vec<ChitUserBalance>, user_id: UserId, chit: i32) {
        if chit <= 0 {
            leaderboard.retain(|i| i.user_id != user_id);
            return;
        }

        let full = leaderboard.len() >= MAX_LEADERS;
        let chit = chit as u32;

        if let Some(last) = leaderboard.last() {
            if full && chit <= last.balance {
                return;
            }
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

    pub fn all_time(&self) -> &Vec<ChitUserBalance> {
        &self.all_time
    }

    pub fn this_month(&self) -> &Vec<ChitUserBalance> {
        &self.this_month
    }

    pub fn last_month(&self) -> &Vec<ChitUserBalance> {
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
        let mut leaderboard = ChitLeaderboard::default();
        leaderboard.update_position(rnd_user(), 100, 10);
        leaderboard.update_position(rnd_user(), 400, 10);
        leaderboard.update_position(rnd_user(), 200, 10);

        let leaders = leaderboard.all_time();

        assert_eq!(leaders.len(), 3);
        assert_eq!(leaders[0].balance, 400);
        assert_eq!(leaders[1].balance, 200);
        assert_eq!(leaders[2].balance, 100);
    }

    #[test]
    fn max_leaders_not_exceeded() {
        let mut leaderboard = ChitLeaderboard::default();

        for _ in 0..(2 * MAX_LEADERS) {
            leaderboard.update_position(rnd_user(), rnd_balance(), 10);
        }

        let leaders = leaderboard.all_time();

        assert_eq!(leaders.len(), MAX_LEADERS);
    }

    #[test]
    fn update_same_user_handled_correctly() {
        let mut leaderboard = ChitLeaderboard::default();
        let me = rnd_user();

        leaderboard.update_position(me, 100, 10);
        leaderboard.update_position(me, 400, 10);

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
