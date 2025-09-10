use candid::Principal;
use constants::calculate_summary_updates_data_removal_cutoff;
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::collections::{btree_map::Entry, BTreeMap, BTreeSet};
use types::{BotPermissions, BotSubscriptions, OptionUpdate, TimestampMillis, UserId};

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
        command_permissions: BotPermissions,
        autonomous_permissions: Option<BotPermissions>,
        default_subscriptions: OptionUpdate<BotSubscriptions>,
        now: TimestampMillis,
    ) -> bool {
        match self.bots.entry(bot_id) {
            Entry::Vacant(_) => false,
            Entry::Occupied(mut o) => {
                let bot = o.get_mut();
                bot.permissions = command_permissions;
                bot.autonomous_permissions = autonomous_permissions;
                match default_subscriptions {
                    OptionUpdate::NoChange => (),
                    OptionUpdate::SetToNone => bot.default_subscriptions = None,
                    OptionUpdate::SetToSome(subs) => bot.default_subscriptions = Some(subs),
                }
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

    pub fn user_ids(&self) -> impl Iterator<Item = &UserId> {
        self.bots.keys()
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
