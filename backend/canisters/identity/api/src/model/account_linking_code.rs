use candid::CandidType;
use constants::MINUTE_IN_MS;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{TimestampMillis, UserId};

const ALC_DURATION: u64 = 3 * MINUTE_IN_MS; // 3 minutes in milliseconds

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[ts_export]
pub struct AccountLinkingCode {
    pub value: String,
    pub expires_at: TimestampMillis,
    pub user_id: UserId,
}

impl AccountLinkingCode {
    pub fn new(user_id: UserId, value: String, now: TimestampMillis) -> Self {
        Self {
            value,
            expires_at: now + ALC_DURATION,
            user_id,
        }
    }

    pub fn is_valid(&self, now: TimestampMillis) -> bool {
        now < self.expires_at
    }
}
