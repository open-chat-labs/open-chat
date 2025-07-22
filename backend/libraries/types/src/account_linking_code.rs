use crate::UserId;
use candid::CandidType;
use rand::{Rng, rngs::StdRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
}

#[derive(CandidType, Serialize, Deserialize, Default, Debug)]
pub struct AccountLinkingCodes {
    codes: HashMap<String, AccountLinkingCode>,
}

impl AccountLinkingCodes {
    /// Creates a new code, saves it, and returns a clone back!
    pub fn get_new_linking_code(&mut self, user_id: UserId, rng: &mut StdRng, now: u64) -> Result<AccountLinkingCode, String> {
        let code = Self::generate_code(rng)?;

        // Check if code already exists and is valid
        if self.codes.get(&code).map(|c| c.is_valid(now)).unwrap_or(false) {
            return Err("Code already exists".into());
        }

        let new_linking_code = AccountLinkingCode::new(user_id, code.clone(), now);

        // Add to the map of existing account linking codes!
        self.codes.insert(code, new_linking_code.clone());

        Ok(new_linking_code)
    }

    /// Get the account linking code with specified value.
    pub fn get(&self, code: &String) -> Option<&AccountLinkingCode> {
        self.codes.get(code)
    }

    /// Get account linking code for a user.
    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<AccountLinkingCode> {
        self.codes
            .values()
            .find(|linking_code| linking_code.user_id == *user_id)
            .cloned()
    }

    /// Remove a specific code, that may still be valid!
    pub fn remove(&mut self, code: &String) {
        self.codes.remove(code);
    }

    /// Used to manually clean up expired codes.
    pub fn cleanup(&mut self, now: u64) {
        self.codes.retain(|_, linking_code| linking_code.is_valid(now));
    }

    /// Get number of saved codes
    pub fn len(&self) -> usize {
        self.codes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.codes.is_empty()
    }

    // Generates a random 6 character string.
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
