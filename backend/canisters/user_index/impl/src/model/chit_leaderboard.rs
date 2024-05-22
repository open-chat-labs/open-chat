use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use types::UserId;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ChitLeaderboard {
    list: Vec<ChitUserBalance>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChitUserBalance {
    pub user_id: UserId,
    pub balance: u32,
}

const MAX_LEADERS: usize = 50;

impl ChitLeaderboard {
    pub fn update_position(&mut self, user_id: UserId, latest_balance: i32) {
        if latest_balance <= 0 {
            self.list.retain(|i| i.user_id != user_id);
            return;
        }

        let full = self.list.len() >= MAX_LEADERS;
        let latest_balance = latest_balance as u32;

        if let Some(last) = self.list.last() {
            if full && latest_balance <= last.balance {
                return;
            }
        }

        if let Some(my) = self.list.iter_mut().find(|i| i.user_id == user_id) {
            my.balance = latest_balance;
        } else {
            if full {
                self.list.pop();
            }

            self.list.push(ChitUserBalance {
                user_id,
                balance: latest_balance,
            });
        }

        self.list.sort_unstable_by_key(|i| Reverse(i.balance));
    }

    pub fn get(&self) -> Vec<ChitUserBalance> {
        self.list.clone()
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
        leaderboard.update_position(rnd_user(), 100);
        leaderboard.update_position(rnd_user(), 400);
        leaderboard.update_position(rnd_user(), 200);

        let leaders = leaderboard.get();

        assert_eq!(leaders.len(), 3);
        assert_eq!(leaders[0].balance, 400);
        assert_eq!(leaders[1].balance, 200);
        assert_eq!(leaders[2].balance, 100);
    }

    #[test]
    fn max_leaders_not_exceeded() {
        let mut leaderboard = ChitLeaderboard::default();

        for _ in 0..(2 * MAX_LEADERS) {
            leaderboard.update_position(rnd_user(), rnd_balance());
        }

        let leaders = leaderboard.get();

        assert_eq!(leaders.len(), MAX_LEADERS);
    }

    #[test]
    fn update_same_user_handled_correctly() {
        let mut leaderboard = ChitLeaderboard::default();
        let me = rnd_user();

        leaderboard.update_position(me, 100);
        leaderboard.update_position(me, 400);

        let leaders = leaderboard.get();

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
