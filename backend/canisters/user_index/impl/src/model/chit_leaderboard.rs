use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use types::ChitUserBalance;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ChitLeaderboard {
    list: Vec<ChitUserBalance>,
}

impl ChitLeaderboard {
    pub fn update_position(&mut self, latest: ChitUserBalance) {
        if let Some(last) = self.list.last() {
            if latest.balance <= last.balance {
                return;
            }
        }

        if let Some(me) = self.list.iter_mut().find(|i| i.user_id == latest.user_id) {
            me.balance = latest.balance;
        } else {
            self.list.pop();
            self.list.push(latest);
        }

        self.list.sort_unstable_by_key(|i| Reverse(i.balance));
    }

    pub fn get(&self) -> Vec<ChitUserBalance> {
        self.list.clone()
    }
}
