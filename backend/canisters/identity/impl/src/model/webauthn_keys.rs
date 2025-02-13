use candid::Deserialize;
use identity_canister::WebAuthnKey;
use serde::Serialize;
use serde_bytes::ByteBuf;
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct WebAuthnKeys {
    keys: HashMap<ByteBuf, WebAuthnKeyInternal>,
}

impl WebAuthnKeys {
    pub fn add(&mut self, key: WebAuthnKey, now: TimestampMillis) {
        if let Vacant(e) = self.keys.entry(key.credential_id.into()) {
            e.insert(WebAuthnKeyInternal {
                public_key: key.public_key,
                origin: key.origin,
                cross_platform: key.cross_platform,
                aaguid: key.aaguid,
                created: now,
            });
        } else {
            panic!("WebAuthn credential already exists");
        }
    }

    pub fn get(&self, credential_id: Vec<u8>) -> Option<&WebAuthnKeyInternal> {
        self.keys.get(&ByteBuf::from(credential_id))
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
    #[serde(rename = "g")]
    pub aaguid: [u8; 16],
    #[serde(rename = "c")]
    pub created: TimestampMillis,
}

impl WebAuthnKeyInternal {
    pub fn hydrate(&self, credential_id: Vec<u8>) -> WebAuthnKey {
        WebAuthnKey {
            public_key: self.public_key.clone(),
            credential_id,
            origin: self.origin.clone(),
            cross_platform: self.cross_platform,
            aaguid: self.aaguid,
        }
    }
}
