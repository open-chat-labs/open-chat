use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use types::{ChitUserBalance, UserId};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ChitLeaderboard {
    list: Vec<ChitUserBalance>,
}

impl ChitLeaderboard {
    pub fn update_position(&mut self, user_id: UserId, latest_balance: i32) {
        if latest_balance <= 0 {
            self.list.retain(|i| i.user_id != user_id);
            return;
        }

        let latest_balance = latest_balance as u32;

        if let Some(last) = self.list.last() {
            if latest_balance <= last.balance {
                return;
            }
        }

        if let Some(my) = self.list.iter_mut().find(|i| i.user_id == user_id) {
            my.balance = latest_balance;
        } else {
            self.list.pop();
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
