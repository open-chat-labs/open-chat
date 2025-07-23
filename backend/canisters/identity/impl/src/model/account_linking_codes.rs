use crate::UserId;
use candid::CandidType;
use identity_canister::account_linking_code::AccountLinkingCode;
use rand::{Rng, rngs::StdRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// For [a-zA-Z0-9] characters this gives us 62^6 = 56,800,235,584 possible combinations
const ALC_LENGTH: usize = 6;
const ALC_CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

#[derive(CandidType, Serialize, Deserialize, Default, Debug)]
pub struct AccountLinkingCodes {
    codes: HashMap<String, AccountLinkingCode>,
}

impl AccountLinkingCodes {
    /// Creates a new code, saves it, and returns a clone back!
    pub fn get_new_linking_code(&mut self, user_id: UserId, rng: &mut StdRng, now: u64) -> AccountLinkingCode {
        let code = Self::generate_code(rng);
        let new_linking_code = AccountLinkingCode::new(user_id, code.clone(), now);

        // Add to the map of existing account linking codes! If the same code
        // existed before it will get overwritten, and therefore invalid.
        self.codes.insert(code, new_linking_code.clone());

        new_linking_code
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
    pub fn prune_expired(&mut self, now: u64) {
        self.codes.retain(|_, linking_code| linking_code.is_valid(now));
    }

    /// Get number of saved codes
    pub fn len(&self) -> usize {
        self.codes.len()
    }

    // /// Check if there's no codes
    // pub fn is_empty(&self) -> bool {
    //     self.codes.is_empty()
    // }

    // Generates a random 6 character string.
    fn generate_code(rng: &mut StdRng) -> String {
        let bytes: [u8; ALC_LENGTH] = rng.r#gen();

        // Map bytes to characters
        bytes[..ALC_LENGTH]
            .iter()
            .map(|&b| {
                let idx = (b as usize) % ALC_CHARSET.len();
                ALC_CHARSET[idx] as char
            })
            .collect()
    }
}
