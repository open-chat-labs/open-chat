use rand::{rngs::StdRng, Rng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BotPermissions, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct BotApiKeys {
    keys: HashMap<UserId, ApiKey>,
}

#[derive(Serialize, Deserialize)]
pub struct ApiKey {
    pub secret: String,
    pub permissions: BotPermissions,
    pub generated_by: UserId,
    pub generated_at: TimestampMillis,
}

impl BotApiKeys {
    pub fn generate(&mut self, user_id: UserId, permissions: BotPermissions, now: TimestampMillis, rng: &mut StdRng) -> String {
        let key = rng.gen::<u128>().to_string();
        self.keys.insert(
            user_id,
            ApiKey {
                secret: key.clone(),
                permissions,
                generated_by: user_id,
                generated_at: now,
            },
        );
        key
    }

    pub fn get(&self, bot_id: &UserId) -> Option<&ApiKey> {
        self.keys.get(bot_id)
    }
}
