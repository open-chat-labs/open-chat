use candid::Principal;
use constants::calculate_summary_updates_data_removal_cutoff;
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::collections::{btree_map::Entry, BTreeMap, BTreeSet};
use types::{BotDefinitionUpdate, BotPermissions, BotSubscriptions, OptionUpdate, TimestampMillis, UserId};

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

    pub fn update_from_definition(&mut self, update: BotDefinitionUpdate, now: TimestampMillis) -> bool {
        let Some(bot) = self.bots.get_mut(&update.bot_id) else {
            return false;
        };

        // The stored bot permissions are _granted_ permissions, whereas the incoming permissions are
        // those requested by the bot. So intersect the requested permissions with the stored permissions.

        match update.command_permissions {
            OptionUpdate::NoChange => (),
            OptionUpdate::SetToNone => bot.permissions = BotPermissions::default(),
            OptionUpdate::SetToSome(requested) => bot.permissions = bot.permissions.intersect(&requested),
        };

        match update.autonomous_permissions {
            OptionUpdate::NoChange => (),
            OptionUpdate::SetToNone => bot.autonomous_permissions = None,
            OptionUpdate::SetToSome(requested) => {
                bot.autonomous_permissions = bot
                    .autonomous_permissions
                    .as_ref()
                    .map(|existing| existing.intersect(&requested))
            }
        };

        match update.default_subscriptions {
            OptionUpdate::NoChange => (),
            OptionUpdate::SetToNone => bot.default_subscriptions = None,
            OptionUpdate::SetToSome(subs) => bot.default_subscriptions = Some(subs),
        }

        self.prune_then_insert_member_update(update.bot_id, BotUpdate::Updated, now);
        true
    }

    pub fn update_permissions(
        &mut self,
        bot_id: UserId,
        command_permissions: BotPermissions,
        autonomous_permissions: Option<BotPermissions>,
        now: TimestampMillis,
    ) -> bool {
        match self.bots.entry(bot_id) {
            Entry::Vacant(_) => false,
            Entry::Occupied(mut o) => {
                let bot = o.get_mut();
                bot.permissions = command_permissions;
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

    // Passes the id of the user who added each bot through `f`, replacing each with the id returned,
    // and records an update for each bot changed so that clients are sent it again. Returns how many
    // were changed.
    pub fn update_added_by(&mut self, f: &mut dyn FnMut(UserId) -> UserId, now: TimestampMillis) -> u32 {
        let mut updated = Vec::new();
        for (bot_id, bot) in self.bots.iter_mut() {
            let added_by = f(bot.added_by);
            if added_by != bot.added_by {
                bot.added_by = added_by;
                updated.push(*bot_id);
            }
        }
        for bot_id in updated.iter() {
            self.prune_then_insert_member_update(*bot_id, BotUpdate::Updated, now);
        }
        updated.len() as u32
    }

    // Records `user_id` as having added each bot which was added under one of `previous_user_ids`,
    // the ids the user had before being migrated to a MultiUser canister. Returns how many there were.
    pub fn migrate_added_by(&mut self, previous_user_ids: &[UserId], user_id: UserId, now: TimestampMillis) -> u32 {
        self.update_added_by(
            &mut |added_by| if previous_user_ids.contains(&added_by) { user_id } else { added_by },
            now,
        )
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

    // Whether any update made after `since` has been pruned, so that `iter_latest_updates(since)`
    // doesn't return them all
    pub fn any_updates_removed(&self, since: TimestampMillis) -> bool {
        self.latest_update_removed > since
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

#[derive(Serialize, Deserialize, Clone)]
pub struct BotInternal {
    pub added_by: UserId,
    pub permissions: BotPermissions,
    #[serde(default)]
    pub autonomous_permissions: Option<BotPermissions>,
    #[serde(default)]
    pub default_subscriptions: Option<BotSubscriptions>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn added_by_is_replaced_and_an_update_recorded() {
        let mut bots = InstalledBots::default();
        bots.add(user_id(1), user_id(10), BotPermissions::default(), None, None, 1);
        bots.add(user_id(2), user_id(11), BotPermissions::default(), None, None, 1);

        let updated = bots.update_added_by(&mut |u| if u == user_id(10) { user_id(20) } else { u }, 5);

        assert_eq!(updated, 1);
        assert_eq!(bots.get(&user_id(1)).unwrap().added_by, user_id(20));
        assert_eq!(bots.get(&user_id(2)).unwrap().added_by, user_id(11));
        assert!(bots.iter_latest_updates(1).eq([(user_id(1), BotUpdate::Updated)]));
        assert_eq!(
            bots.update_added_by(&mut |u| if u == user_id(10) { user_id(20) } else { u }, 6),
            0
        );
    }

    #[test]
    fn bots_added_under_a_previous_id_are_recorded_as_added_by_the_latest() {
        let mut bots = InstalledBots::default();
        let (old, latest, bot1, bot2) = (user_id(1), user_id(2), user_id(10), user_id(11));
        bots.add(bot1, old, BotPermissions::default(), None, None, 10);
        bots.add(bot2, latest, BotPermissions::default(), None, None, 20);

        assert_eq!(bots.migrate_added_by(&[old], latest, 30), 1);

        assert!(bots.get(&bot1).is_some_and(|b| b.added_by == latest));
        assert!(bots.get(&bot2).is_some_and(|b| b.added_by == latest));
        let updates: Vec<_> = bots.iter_latest_updates(20).collect();
        assert!(matches!(updates.as_slice(), [(bot_id, BotUpdate::Updated)] if *bot_id == bot1));
        assert_eq!(bots.migrate_added_by(&[old], latest, 40), 0);
        assert_eq!(bots.last_updated(), 30);
    }
}
