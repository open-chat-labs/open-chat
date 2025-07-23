use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

const ALC_DURATION: u64 = 5 * 60 * 1000; // 5 minutes in milliseconds

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[ts_export]
pub struct AccountLinkingCode {
    pub value: String,
    pub expires_at: u64, // timestamp in milliseconds
    pub user_id: UserId,
}

impl AccountLinkingCode {
    pub fn new(user_id: UserId, value: String, now: u64) -> Self {
        Self {
            value,
            expires_at: now + ALC_DURATION,
            user_id,
        }
    }

    pub fn is_valid(&self, now: u64) -> bool {
        now < self.expires_at
    }

    pub fn is_valid_for_more_than_a_minute(&self, now: u64) -> bool {
        self.expires_at > now && self.expires_at - now > 60_000 // 60 sec in ms
    }
}
