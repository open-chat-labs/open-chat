use candid::Deserialize;
use serde::Serialize;
use serde_bytes::ByteBuf;
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct WebAuthnKeys {
    keys: HashMap<ByteBuf, WebAuthnKey>,
}

impl WebAuthnKeys {
    pub fn add(&mut self, credential_id: Vec<u8>, public_key: Vec<u8>, now: TimestampMillis) -> bool {
        if let Vacant(e) = self.keys.entry(credential_id.into()) {
            e.insert(WebAuthnKey {
                public_key,
                created: now,
                last_used: now,
            });
            true
        } else {
            false
        }
    }

    pub fn get_public_key(&self, credential_id: ByteBuf) -> Option<&[u8]> {
        self.keys.get(&credential_id).map(|k| k.public_key.as_slice())
    }

    pub fn mark_used(&mut self, credential_id: ByteBuf, now: TimestampMillis) {
        if let Some(key) = self.keys.get_mut(&credential_id) {
            key.last_used = now;
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct WebAuthnKey {
    pub public_key: Vec<u8>,
    pub created: TimestampMillis,
    pub last_used: TimestampMillis,
}
