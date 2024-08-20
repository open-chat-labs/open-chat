use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ReferralStatus, TimestampMillis, Timestamped, UserId};
use user_canister::Referral;

#[derive(Serialize, Deserialize, Default)]
pub struct Referrals {
    users: HashMap<UserId, Timestamped<ReferralStatus>>,
}

impl Referrals {
    pub fn set_status(&mut self, user_id: UserId, status: ReferralStatus, now: TimestampMillis) -> u32 {
        let current_status = self.users.get(&user_id);
        let current_chit_reward = current_status.map(|s| s.chit_reward()).unwrap_or_default();
        let chit_reward_diff = status.chit_reward().saturating_sub(current_chit_reward);

        // TODO: Once the referral sync has happened this needs to be changed so that nothing happens if the current status is empty.
        if (current_status.is_none() && matches!(status, ReferralStatus::Registered)) || chit_reward_diff > 0 {
            self.users.insert(user_id, Timestamped::new(status, now));
        }

        chit_reward_diff
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
