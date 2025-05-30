use candid::Principal;
use constants::calculate_summary_updates_data_removal_cutoff;
use rand::{rngs::StdRng, Rng};
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::collections::{btree_map::Entry, BTreeMap, BTreeSet, HashMap};
use types::{ApiKey, BotPermissions, BotSubscriptions, PublicApiKeyDetails, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct InstalledBots {
    bots: BTreeMap<UserId, BotInternal>,
    updates: BTreeSet<(TimestampMillis, UserId, BotUpdate)>,
    latest_update_removed: TimestampMillis,
}

impl InstalledBots {
    pub fn add(
        &mut self,
        bot_id: UserId,
        added_by: UserId,
        permissions: BotPermissions,
        autonomous_permissions: Option<BotPermissions>,
        default_subscriptions: Option<BotSubscriptions>,
        now: TimestampMillis,
    ) -> bool {
        if self.bots.contains_key(&bot_id) {
            return false;
        }

        self.bots.insert(
            bot_id,
            BotInternal {
                added_by,
                permissions,
                autonomous_permissions,
                default_subscriptions,
            },
        );
        self.prune_then_insert_member_update(bot_id, BotUpdate::Added, now);

        true
    }

    pub fn update(
        &mut self,
        bot_id: UserId,
        permissions: BotPermissions,
        autonomous_permissions: Option<BotPermissions>,
        now: TimestampMillis,
    ) -> bool {
        match self.bots.entry(bot_id) {
            Entry::Vacant(_) => false,
            Entry::Occupied(mut o) => {
                let bot = o.get_mut();
                bot.permissions = permissions;
                bot.autonomous_permissions = autonomous_permissions;
                self.prune_then_insert_member_update(bot_id, BotUpdate::Updated, now);
                true
            }
        }
    }

    pub fn remove(&mut self, bot_id: UserId, now: TimestampMillis) -> bool {
        let removed = self.bots.remove(&bot_id).is_some();

        if removed {
            self.prune_then_insert_member_update(bot_id, BotUpdate::Removed, now);
        }

        removed
    }

    pub fn get(&self, bot_id: &UserId) -> Option<&BotInternal> {
        self.bots.get(bot_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &BotInternal)> {
        self.bots.iter()
    }

    pub fn iter_latest_updates(&self, since: TimestampMillis) -> impl Iterator<Item = (UserId, BotUpdate)> + '_ {
        self.updates
            .iter()
            .rev()
            .take_while(move |(ts, _, _)| *ts > since)
            .map(|(_, bot_id, update)| (*bot_id, *update))
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.updates.iter().next_back().map_or(0, |(ts, _, _)| *ts)
    }

    fn prune_then_insert_member_update(&mut self, bot_id: UserId, update: BotUpdate, now: TimestampMillis) {
        self.prune_member_updates(now);
        self.updates.insert((now, bot_id, update));
    }

    fn prune_member_updates(&mut self, now: TimestampMillis) -> u32 {
        let cutoff = calculate_summary_updates_data_removal_cutoff(now);
        let still_valid = self
            .updates
            .split_off(&(cutoff, Principal::anonymous().into(), BotUpdate::Added));

        let removed = std::mem::replace(&mut self.updates, still_valid);

        if let Some((ts, _, _)) = removed.last() {
            self.latest_update_removed = *ts;
        }

        removed.len() as u32
    }
}

#[derive(Serialize_repr, Deserialize_repr, Clone, Copy, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u8)]
pub enum BotUpdate {
    Added = 1,
    Removed = 2,
    Updated = 3,
}

#[derive(Serialize, Deserialize)]
pub struct BotInternal {
    pub added_by: UserId,
    pub permissions: BotPermissions,
    #[serde(default)]
    pub autonomous_permissions: Option<BotPermissions>,
    #[serde(default)]
    pub default_subscriptions: Option<BotSubscriptions>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct BotApiKeys {
    keys: HashMap<UserId, ApiKey>,
}

impl BotApiKeys {
    pub fn generate(
        &mut self,
        bot_id: UserId,
        granted_permissions: BotPermissions,
        now: TimestampMillis,
        rng: &mut StdRng,
    ) -> GenerateApiKeyResult {
        let new_key = rng.r#gen::<u128>().to_string();
        let old_key = self
            .keys
            .insert(
                bot_id,
                ApiKey {
                    secret: new_key.clone(),
                    granted_permissions,
                    generated_by: bot_id,
                    generated_at: now,
                },
            )
            .map(|k| k.secret);

        GenerateApiKeyResult { new_key, old_key }
    }

    pub fn delete(&mut self, bot_id: UserId) -> bool {
        self.keys.remove(&bot_id).is_some()
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

pub struct GenerateApiKeyResult {
    pub new_key: String,
    pub old_key: Option<String>,
}
