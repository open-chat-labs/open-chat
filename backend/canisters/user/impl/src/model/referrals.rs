use serde::{Deserialize, Serialize};
use std::collections::{hash_map::Entry, HashMap};
use types::{ReferralStatus, TimestampMillis, Timestamped, UserId};
use user_canister::Referral;

#[derive(Serialize, Deserialize, Default)]
pub struct Referrals {
    users: HashMap<UserId, Timestamped<ReferralStatus>>,
}

impl Referrals {
    pub fn new(referrals: HashMap<UserId, ReferralStatus>, now: TimestampMillis) -> Referrals {
        Referrals {
            users: referrals
                .into_iter()
                .map(|(user_id, status)| (user_id, Timestamped::new(status, now)))
                .collect(),
        }
    }

    pub fn register(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        self.users
            .insert(user_id, Timestamped::new(ReferralStatus::Registered, now))
            .is_none()
    }

    pub fn set_status(&mut self, user_id: UserId, status: ReferralStatus, now: TimestampMillis) -> u32 {
        match self.users.entry(user_id) {
            Entry::Occupied(mut e) => {
                let current_status = e.get();
                let chit_reward = status.chit_reward().saturating_sub(current_status.chit_reward());

                e.insert(Timestamped::new(status, now));

                chit_reward
            }
            Entry::Vacant(_) => 0,
        }
    }

    pub fn list(&self) -> Vec<Referral> {
        self.users
            .iter()
            .map(|(user_id, status)| Referral {
                user_id: *user_id,
                status: status.value,
            })
            .collect()
    }

    pub fn total_verified(&self) -> usize {
        self.users
            .values()
            .filter(|s| !matches!(s.value, ReferralStatus::Registered))
            .count()
    }

    pub fn updated_since(&self, since: TimestampMillis) -> Vec<Referral> {
        self.users
            .iter()
            .filter(|(_, status)| status.timestamp > since)
            .map(|(user_id, status)| Referral {
                user_id: *user_id,
                status: status.value,
            })
            .collect()
    }
}
