use crate::UserId;
use candid::CandidType;
use rand::{Rng, rngs::StdRng};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

// For [a-zA-Z0-9] characters this gives us 62^6 = 56,800,235,584 possible combinations
const ALC_LENGTH: usize = 6;
const ALC_DURATION: u64 = 5 * 60 * 1000; // 5 minutes in milliseconds
const ALC_CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[ts_export]
pub struct AccountLinkingCode {
    pub value: String,
    pub expires_at: u64, // timestamp in milliseconds
    pub user_id: UserId,
}

impl AccountLinkingCode {
    pub fn new(user_id: UserId, rng: &mut StdRng, now: u64) -> Result<Self, String> {
        let value = Self::generate_code(rng)?;

        Ok(Self {
            value,
            expires_at: now + ALC_DURATION,
            user_id,
        })
    }

    pub fn is_valid(&self, now: u64) -> bool {
        now < self.expires_at
    }

    fn generate_code(rng: &mut StdRng) -> Result<String, String> {
        let bytes: [u8; 32] = rng.r#gen();

        // Validate and prepare seed
        if bytes.len() < ALC_LENGTH {
            return Err("Insufficient random bytes from raw_rand".to_string());
        }

        // Map bytes to characters
        let code: String = bytes[..ALC_LENGTH]
            .iter()
            .map(|&b| {
                let idx = (b as usize) % ALC_CHARSET.len();
                ALC_CHARSET[idx] as char
            })
            .collect();

        Ok(code)
    }
}
