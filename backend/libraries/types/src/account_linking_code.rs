use candid::CandidType;
use rand::{Rng, distributions::Alphanumeric};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

// For [a-zA-Z0-9] characters this gives us 62^6 = 56,800,235,584 possible combinations
pub const OTP_LENGTH: usize = 6;
pub const OTP_DURATION: u64 = 5 * 60 * 1000; // 5 minutes in milliseconds

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[ts_export]
pub struct AccountLinkingCode {
    pub value: String,
    pub expires_at: u64, // timestamp in milliseconds
}

impl AccountLinkingCode {
    pub fn new(now: u64) -> Self {
        let value = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(OTP_LENGTH)
            .map(char::from)
            .collect::<String>();

        Self {
            value,
            expires_at: now + OTP_DURATION,
        }
    }

    pub fn is_valid(&self, now: u64) -> bool {
        now < self.expires_at
    }
}
