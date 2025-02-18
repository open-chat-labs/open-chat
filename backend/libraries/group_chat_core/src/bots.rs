use rand::{rngs::StdRng, Rng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ApiKey, BotPermissions, PublicApiKeyDetails, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct BotApiKeys {
    keys: HashMap<UserId, ApiKey>,
}

impl BotApiKeys {
    pub fn generate(
        &mut self,
        user_id: UserId,
        granted_permissions: BotPermissions,
        now: TimestampMillis,
        rng: &mut StdRng,
    ) -> String {
        let key = rng.gen::<u128>().to_string();
        self.keys.insert(
            user_id,
            ApiKey {
                secret: key.clone(),
                granted_permissions,
                generated_by: user_id,
                generated_at: now,
            },
        );
        key
    }

    pub fn get(&self, bot_id: &UserId) -> Option<&ApiKey> {
        self.keys.get(bot_id)
    }

    pub fn permissions_if_secret_matches(&self, bot_id: &UserId, secret: &str) -> Option<&BotPermissions> {
        self.keys
            .get(bot_id)
            .filter(|k| k.secret == secret)
            .map(|k| &k.granted_permissions)
    }

    pub fn generated_since(&self, since: TimestampMillis) -> Vec<PublicApiKeyDetails> {
        self.keys
            .iter()
            .filter_map(|(bot_id, key)| {
                if key.generated_at > since {
                    Some(PublicApiKeyDetails {
                        bot_id: *bot_id,
                        granted_permissions: key.granted_permissions.clone(),
                        generated_by: key.generated_by,
                        generated_at: key.generated_at,
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.keys.values().map(|k| k.generated_at).max().unwrap_or_default()
    }
}
