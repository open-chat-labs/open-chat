use candid::Principal;
use rand::{Rng, rngs::StdRng};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{Document, OptionUpdate, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Webhooks {
    map: BTreeMap<UserId, Webhook>,
    last_updated: TimestampMillis,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Webhook {
    pub name: String,
    pub avatar: Option<Document>,
    pub secret: String,
}

impl Webhooks {
    pub fn register(
        &mut self,
        name: String,
        avatar: Option<Document>,
        rng: &mut StdRng,
        now: TimestampMillis,
    ) -> Option<UserId> {
        if self.map.values().any(|webhook| webhook.name == name) {
            return None;
        }

        let id = Self::generate_random_id(rng);

        self.map.insert(
            id,
            Webhook {
                name,
                avatar,
                secret: Self::generate_secret(rng),
            },
        );

        self.last_updated = now;

        Some(id)
    }

    pub fn regenerate(&mut self, id: UserId, rng: &mut StdRng, now: TimestampMillis) -> bool {
        if let Some(webhook) = self.map.get_mut(&id) {
            webhook.secret = Self::generate_secret(rng);
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn update(&mut self, id: UserId, name: Option<String>, avatar: OptionUpdate<Document>, now: TimestampMillis) -> bool {
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

    pub fn remove(&mut self, id: &UserId, now: TimestampMillis) -> Option<Webhook> {
        if let Some(webhook) = self.map.remove(id) {
            self.last_updated = now;
            Some(webhook)
        } else {
            None
        }
    }

    pub fn get(&self, id: &UserId) -> Option<&Webhook> {
        self.map.get(id)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &Webhook)> {
        self.map.iter()
    }

    pub fn user_ids(&self) -> impl Iterator<Item = &UserId> {
        self.map.keys()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    fn generate_random_id(rng: &mut StdRng) -> UserId {
        Principal::from_slice(&rng.r#gen::<[u8; 8]>()).into()
    }

    fn generate_secret(rng: &mut StdRng) -> String {
        let secret_bytes = rng.r#gen::<[u8; 16]>();
        hex::encode(secret_bytes)
    }
}
