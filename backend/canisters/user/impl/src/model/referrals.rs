use std::collections::{hash_map::Entry, HashMap};

use serde::{Deserialize, Serialize};
use types::{ReferralStatus, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Referrals {
    users: HashMap<UserId, ReferralStatus>,
}

impl Referrals {
    pub fn new(referrals: HashMap<UserId, ReferralStatus>) -> Referrals {
        Referrals { users: referrals }
    }

    pub fn register(&mut self, user_id: UserId) -> bool {
        self.users.insert(user_id, ReferralStatus::Registered).is_none()
    }

    pub fn set_status(&mut self, user_id: UserId, status: ReferralStatus) -> u32 {
        match self.users.entry(user_id) {
            Entry::Occupied(mut e) => {
                let current_status = e.get();
                let chit_reward = status.chit_reward().saturating_sub(current_status.chit_reward());

                e.insert(status);

                chit_reward
            }
            Entry::Vacant(_) => 0,
        }
    }

    pub fn referrals(&self) -> HashMap<UserId, ReferralStatus> {
        self.users.clone()
    }

    pub fn total_verified(&self) -> usize {
        self.users
            .values()
            .filter(|s| !matches!(**s, ReferralStatus::Registered))
            .count()
    }
}
