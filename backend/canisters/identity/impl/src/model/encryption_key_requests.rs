use identity_canister::get_encryption_key::KeyType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{Milliseconds, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct EncryptionKeyRequests {
    per_user: BTreeMap<UserId, UserEncryptionKeyRequests>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
struct UserEncryptionKeyRequests {
    #[serde(skip)]
    in_progress: u8,
    requests: Vec<EncryptionKeyRequest>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct EncryptionKeyRequest {
    timestamp: TimestampMillis,
    key_type: KeyType,
    error: Option<OCError>,
}

impl EncryptionKeyRequests {
    pub fn try_start_for_user(&mut self, user_id: UserId, now: TimestampMillis) -> Result<(), Milliseconds> {
        self.per_user.entry(user_id).or_default().try_start_for_user(now)
    }

    pub fn mark_complete(&mut self, user_id: &UserId, key_type: KeyType, error: Option<OCError>, now: TimestampMillis) {
        if let Some(u) = self.per_user.get_mut(user_id) {
            u.mark_complete(key_type, error, now);
        }
    }
}

impl UserEncryptionKeyRequests {
    pub fn try_start_for_user(&mut self, now: TimestampMillis) -> Result<(), Milliseconds> {
        self.check_if_should_throttle(now)?;
        self.in_progress = self.in_progress.saturating_add(1);
        Ok(())
    }

    pub fn mark_complete(&mut self, key_type: KeyType, error: Option<OCError>, now: TimestampMillis) {
        self.in_progress = self.in_progress.saturating_sub(1);
        self.requests.push(EncryptionKeyRequest {
            timestamp: now,
            key_type,
            error,
        });
    }

    fn check_if_should_throttle(&mut self, _now: TimestampMillis) -> Result<(), Milliseconds> {
        // TODO - implement this
        Ok(())
    }
}
