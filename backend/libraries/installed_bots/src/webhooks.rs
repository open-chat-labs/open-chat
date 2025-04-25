use base64::Engine;
use candid::Principal;
use rand::{rngs::StdRng, Rng};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{Document, OptionUpdate, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Webhooks {
    map: BTreeMap<Principal, Webhook>,
    last_updated: TimestampMillis,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Webhook {
    pub name: String,
    pub avatar: Option<Document>,
    pub secret: String,
}

impl Webhooks {
    pub fn register(&mut self, name: String, avatar: Option<Document>, rng: &mut StdRng, now: TimestampMillis) -> bool {
        if self.map.values().any(|webhook| webhook.name == name) {
            return false;
        }

        self.map.insert(
            Self::generate_random_id(rng),
            Webhook {
                name,
                avatar,
                secret: Self::generate_secret(rng),
            },
        );

        self.last_updated = now;

        true
    }

    pub fn regenerate(&mut self, id: Principal, rng: &mut StdRng, now: TimestampMillis) -> bool {
        if let Some(webhook) = self.map.get_mut(&id) {
            webhook.secret = rng.gen::<u128>().to_string();
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn update(
        &mut self,
        id: Principal,
        name: Option<String>,
        avatar: OptionUpdate<Document>,
        now: TimestampMillis,
    ) -> bool {
        if let Some(webhook) = self.map.get_mut(&id) {
            if let Some(name) = name {
                webhook.name = name;
            }

            match avatar {
                OptionUpdate::SetToNone => webhook.avatar = None,
                OptionUpdate::SetToSome(avatar) => webhook.avatar = Some(avatar),
                OptionUpdate::NoChange => {}
            }

            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, id: &Principal, now: TimestampMillis) -> Option<Webhook> {
        if let Some(webhook) = self.map.remove(id) {
            self.last_updated = now;
            Some(webhook)
        } else {
            None
        }
    }

    pub fn get(&self, id: &Principal) -> Option<&Webhook> {
        self.map.get(id)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&Principal, &Webhook)> {
        self.map.iter()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    fn generate_random_id(rng: &mut StdRng) -> Principal {
        Principal::from_slice(&rng.gen::<[u8; 8]>())
    }

    fn generate_secret(rng: &mut StdRng) -> String {
        let secret_bytes = rng.gen::<[u8; 16]>();
        let base64_encoded = base64::engine::general_purpose::STANDARD.encode(secret_bytes);
        let url_encoded = urlencoding::encode(&base64_encoded);
        url_encoded.to_string()
    }
}
