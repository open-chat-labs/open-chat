use crate::UserId;
use candid::{CandidType, Principal};
use constants::MINUTE_IN_MS;
use identity_canister::account_linking_code::AccountLinkingCode;
use rand::{Rng, rngs::StdRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::TimestampMillis;

// For Crockford's charset this gives us $32^6 = 1,073,741,824 possible combinations
const ALC_LENGTH: usize = 6;
const ALC_CHARSET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

#[derive(CandidType, Serialize, Deserialize, Default, Debug)]
pub struct AccountLinkingCodes {
    codes: HashMap<String, AccountLinkingCode>,
    verified_temp_keys: HashMap<Principal, AccountLinkingCode>,
}

impl AccountLinkingCodes {
    /// Creates a new code, saves it, and returns a clone back!
    pub fn get_new_linking_code(
        &mut self,
        user_id: UserId,
        username: String,
        rng: &mut StdRng,
        now: TimestampMillis,
    ) -> AccountLinkingCode {
        let code = self.generate_code(rng);
        let new_linking_code = AccountLinkingCode::new(code.clone(), user_id, username, now);

        // Add to the map of existing account linking codes
        self.codes.insert(code, new_linking_code.clone());

        new_linking_code
    }

    pub fn verify_with_temp_key(
        &mut self,
        code: String,
        temp_key: Principal,
        now: TimestampMillis,
    ) -> Result<AccountLinkingCode, ()> {
        let Some(mut linking_code) = self.remove(code) else {
            return Err(());
        };

        // Check if the linking code is still valid (i.e. not expired).
        if !linking_code.is_valid(now) {
            return Err(());
        }

        // Gives the user a bit more time to create a passkey, and link their
        // acount
        linking_code.expires_at = now + 5 * MINUTE_IN_MS;

        // Add the code to the verified map
        self.verified_temp_keys.insert(temp_key, linking_code.clone());

        Ok(linking_code)
    }

    pub fn get_verified_by_temp_key(&self, temp_key: &Principal) -> Option<&AccountLinkingCode> {
        self.verified_temp_keys.get(temp_key)
    }

    /// Get account linking code for a user.
    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<AccountLinkingCode> {
        self.codes
            .values()
            .find(|linking_code| linking_code.user_id == *user_id)
            .cloned()
    }

    /// Remove a specific code, that may still be valid!
    pub fn remove(&mut self, code: String) -> Option<AccountLinkingCode> {
        self.codes.remove(&code.to_uppercase())
    }

    pub fn remove_verified(&mut self, temp_key: &Principal) {
        self.verified_temp_keys.remove(temp_key);
    }

    /// Used to manually clean up expired codes.
    pub fn prune_expired(&mut self, now: TimestampMillis) {
        self.codes.retain(|_, linking_code| linking_code.is_valid(now));
        self.verified_temp_keys.retain(|_, linking_code| linking_code.is_valid(now));
    }

    /// Get number of saved codes
    pub fn len(&self) -> usize {
        self.codes.len()
    }

    // Generates a random 6 character string.
    fn generate_code(&self, rng: &mut StdRng) -> String {
        loop {
            let code = (0..ALC_LENGTH)
                .map(|_| {
                    let idx = rng.gen_range(0..ALC_CHARSET.len());
                    ALC_CHARSET[idx] as char
                })
                .collect();

            if !self.codes.contains_key(&code) {
                return code;
            }
        }
    }
}
