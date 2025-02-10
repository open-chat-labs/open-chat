use candid::Deserialize;
use identity_canister::WebAuthnKey;
use serde::Serialize;
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct WebAuthnKeys {
    keys: HashMap<Vec<u8>, WebAuthnKeyInternal>,
}

impl WebAuthnKeys {
    pub fn add(&mut self, key: WebAuthnKey, public_key: Vec<u8>, now: TimestampMillis) {
        if let Vacant(e) = self.keys.entry(key.credential_id) {
            e.insert(WebAuthnKeyInternal {
                public_key,
                origin: key.origin,
                cross_platform: key.cross_platform,
                created: now,
            });
        } else {
            panic!("WebAuthn credential already exists");
        }
    }

    pub fn get_pubkey(&self, credential_id: &[u8]) -> Option<&[u8]> {
        self.keys.get(credential_id).map(|k| k.public_key.as_ref())
    }
}

#[derive(Serialize, Deserialize)]
pub struct WebAuthnKeyInternal {
    #[serde(rename = "p")]
    pub public_key: Vec<u8>,
    #[serde(rename = "o")]
    pub origin: String,
    #[serde(rename = "x")]
    pub cross_platform: bool,
    #[serde(rename = "c")]
    pub created: TimestampMillis,
}
