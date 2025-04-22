use candid::Principal;
use rand::RngCore;
use rand::{rngs::StdRng, Rng};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{Document, OptionUpdate, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Webhooks {
    map: BTreeMap<Principal, Webhook>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Webhook {
    name: String,
    avatar: Option<Document>,
    secret: String,
    updated: TimestampMillis,
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
                secret: rng.gen::<u128>().to_string(),
                updated: now,
            },
        );

        true
    }

    pub fn regenerate(&mut self, id: Principal, rng: &mut StdRng, now: TimestampMillis) -> bool {
        if let Some(webhook) = self.map.get_mut(&id) {
            webhook.secret = rng.gen::<u128>().to_string();
            webhook.updated = now;
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

            webhook.updated = now;
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, id: &Principal) -> Option<Webhook> {
        self.map.remove(id)
    }

    pub fn get(&self, id: &Principal) -> Option<&Webhook> {
        self.map.get(id)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&Principal, &Webhook)> {
        self.map.iter()
    }

    fn generate_random_id(rng: &mut StdRng) -> Principal {
        let mut id_bytes: [u8; 8] = [0; 8];
        rng.fill_bytes(&mut id_bytes);
        Principal::from_slice(&id_bytes)
    }
}
