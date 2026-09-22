use crate::{User, merge_maps, sorted_pinned};
use installed_bots::BotUpdate;
use std::collections::HashSet;
use types::{CanisterId, Chat, InstalledBotDetails, OptionUpdate, TimestampMillis, UserId};
use user_canister::{initial_state, updates};

// The `initial_state` and `updates` queries, shared by the User and MultiUser canisters
impl User {
    pub fn initial_state(
        &self,
        my_user_id: UserId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> initial_state::SuccessResult {
        let direct_chats = initial_state::DirectChatsInitial {
            summaries: self.direct_chats.iter().map(|chat| chat.to_summary(my_user_id)).collect(),
        };

        let group_chats = initial_state::GroupChatsInitial {
            summaries: self.group_chats.iter().map(|g| g.to_summary()).collect(),
        };

        let communities = initial_state::CommunitiesInitial {
            summaries: self.communities.iter().map(|c| c.to_summary()).collect(),
        };

        let favourite_chats = initial_state::FavouriteChatsInitial {
            chats: self.favourite_chats.chats().to_vec(),
            pinned: sorted_pinned(self.favourite_chats.pinned()),
        };

        let bots = self
            .bots
            .iter()
            .map(|(user_id, bot)| InstalledBotDetails {
                user_id: *user_id,
                added_by: bot.added_by,
                permissions: bot.permissions.clone(),
                autonomous_permissions: bot.autonomous_permissions.clone(),
            })
            .collect();

        initial_state::SuccessResult {
            timestamp: now,
            direct_chats,
            group_chats,
            favourite_chats,
            communities,
            avatar_id: self.avatar.id(),
            blocked_users: self.blocked_users.all().into_iter().collect(),
            suspended: self.suspended.value,
            pin_number_settings: self.pin_number.enabled().then(|| self.pin_number.settings(now)),
            local_user_index_canister_id,
            achievements: self.chit_events.achievements(None),
            achievements_last_seen: self.achievements_last_seen,
            total_chit_earned: self.chit_events.total_chit_earned(),
            chit_balance: self.chit_events.chit_balance(),
            streak: self.streak.days(now),
            streak_ends: self.streak.ends(),
            max_streak: self.streak.max_streak(),
            streak_insurance: self.streak.streak_insurance(now),
            next_daily_claim: self.streak.next_claim(),
            is_unique_person: self.unique_person_proof.is_some(),
            wallet_config: self.wallet_config.value.clone(),
            referrals: self.referrals.list(),
            message_activity_summary: self.message_activity_events.summary(),
            bots,
            btc_address: self.btc_address.as_ref().map(|a| a.value.clone()),
            one_sec_address: self.one_sec_address.as_ref().map(|a| a.value.clone()),
            premium_items: self.premium_items.item_ids(),
            // Only direct and group chats are merged in here; pinned favourites are listed above
            pinned_chats: self.pinned_direct_and_group_chats(),
        }
    }

    // The user's pinned direct and group chats, most recently pinned first, which are pinned in the
    // one list
    fn pinned_direct_and_group_chats(&self) -> Vec<Chat> {
        sorted_pinned(&merge_maps(
            &self.direct_chats.pinned_chats(),
            &self.group_chats.pinned_chats(),
        ))
    }

    // None if nothing has changed since `updates_since`. `now` is only read once something has,
    // since calling `ic0.time()` stops the query's response being cached.
    pub fn updates(
        &self,
        updates_since: TimestampMillis,
        my_user_id: UserId,
        now: impl FnOnce() -> TimestampMillis,
    ) -> Option<updates::SuccessResult> {
        let username = self.username.if_set_after(updates_since).cloned();
        let suspended = self.suspended.if_set_after(updates_since).copied();
        let display_name = self
            .display_name
            .if_set_after(updates_since)
            .map_or(OptionUpdate::NoChange, |update| OptionUpdate::from_update(update.clone()));
        let avatar_id = self
            .avatar
            .id_if_set_after(updates_since)
            .map_or(OptionUpdate::NoChange, OptionUpdate::from_update);
        let blocked_users = self
            .blocked_users
            .if_updated_since(updates_since)
            .map(|user_ids| user_ids.into_iter().collect());
        let pin_number_updated = self.pin_number.last_updated() > updates_since;
        let wallet_config = self.wallet_config.if_set_after(updates_since).cloned();
        let message_activity_summary =
            (self.message_activity_events.last_updated() > updates_since).then(|| self.message_activity_events.summary());
        let streak_insurance_updated = self.streak.insurance_last_updated() > updates_since;
        let is_unique_person_updated = self.unique_person_proof.as_ref().is_some_and(|p| p.timestamp > updates_since);
        let referrals = self.referrals.updated_since(updates_since);
        let btc_address_if_updated = self
            .btc_address
            .as_ref()
            .filter(|a| a.timestamp > updates_since)
            .map(|a| a.value.clone());
        let one_sec_address_if_updated = self
            .one_sec_address
            .as_ref()
            .filter(|a| a.timestamp > updates_since)
            .map(|a| a.value.clone());
        let premium_items_updated = self.premium_items.last_updated() > updates_since;

        let has_any_updates = username.is_some()
            || display_name.has_update()
            || avatar_id.has_update()
            || blocked_users.is_some()
            || pin_number_updated
            || suspended.is_some()
            || wallet_config.is_some()
            || message_activity_summary.is_some()
            || streak_insurance_updated
            || is_unique_person_updated
            || !referrals.is_empty()
            || btc_address_if_updated.is_some()
            || one_sec_address_if_updated.is_some()
            || premium_items_updated
            || self.chit_events.last_updated() > updates_since
            || self.achievements_last_seen > updates_since
            || self.favourite_chats.any_updated(updates_since)
            || self.direct_chats.any_updated(updates_since)
            || self.group_chats.any_updated(updates_since)
            || self.communities.any_updated(updates_since)
            || self.bots.last_updated() > updates_since;

        if !has_any_updates {
            return None;
        }

        let now = now();

        let pin_number_settings = if !pin_number_updated {
            OptionUpdate::NoChange
        } else if self.pin_number.enabled() {
            OptionUpdate::SetToSome(self.pin_number.settings(now))
        } else {
            OptionUpdate::SetToNone
        };

        let mut direct_chats_added = Vec::new();
        let mut direct_chats_updated = Vec::new();
        for chat in self.direct_chats.updated_since(updates_since) {
            if chat.date_created() > updates_since {
                direct_chats_added.push(chat.to_summary(my_user_id));
            } else {
                direct_chats_updated.push(chat.to_summary_updates(updates_since, my_user_id));
            }
        }
        let direct_chats = updates::DirectChatsUpdates {
            added: direct_chats_added,
            updated: direct_chats_updated,
            removed: self.direct_chats.removed_since(updates_since),
        };

        let mut group_chats_added = Vec::new();
        let mut group_chats_updated = Vec::new();
        for group_chat in self.group_chats.updated_since(updates_since) {
            if group_chat.date_joined > updates_since {
                group_chats_added.push(group_chat.to_summary());
            } else {
                group_chats_updated.push(group_chat.to_summary_updates(updates_since));
            }
        }
        let group_chats = updates::GroupChatsUpdates {
            added: group_chats_added,
            updated: group_chats_updated,
            removed: self.group_chats.removed_since(updates_since),
        };

        let mut communities_added = Vec::new();
        let mut communities_updated = Vec::new();
        for community in self.communities.updated_since(updates_since) {
            if community.date_joined > updates_since {
                communities_added.push(community.to_summary());
            } else {
                communities_updated.push(community.to_summary_updates(updates_since));
            }
        }
        let communities = updates::CommunitiesUpdates {
            added: communities_added,
            updated: communities_updated,
            removed: self.communities.removed_since(updates_since),
        };

        // A change to either is reported as the whole merged list
        let pinned_chats = (self.direct_chats.pinned_chats_if_updated(updates_since).is_some()
            || self.group_chats.pinned_chats_if_updated(updates_since).is_some())
        .then(|| self.pinned_direct_and_group_chats());

        let favourite_chats = updates::FavouriteChatsUpdates {
            chats: self.favourite_chats.chats_if_updated(updates_since),
            pinned: self
                .favourite_chats
                .pinned_if_updated(updates_since)
                .map(|pinned| sorted_pinned(&pinned)),
        };

        let mut bots_changed = HashSet::new();
        let mut bots_added_or_updated = Vec::new();
        let mut bots_removed = Vec::new();
        for (user_id, update) in self.bots.iter_latest_updates(updates_since) {
            match update {
                BotUpdate::Added | BotUpdate::Updated => {
                    if bots_changed.insert(user_id)
                        && let Some(bot) = self.bots.get(&user_id)
                    {
                        bots_added_or_updated.push(InstalledBotDetails {
                            user_id,
                            added_by: bot.added_by,
                            permissions: bot.permissions.clone(),
                            autonomous_permissions: bot.autonomous_permissions.clone(),
                        });
                    }
                }
                BotUpdate::Removed => {
                    if bots_changed.insert(user_id) {
                        bots_removed.push(user_id);
                    }
                }
            }
        }

        Some(updates::SuccessResult {
            timestamp: now,
            username,
            display_name,
            direct_chats,
            group_chats,
            favourite_chats,
            communities,
            avatar_id,
            blocked_users,
            suspended,
            pin_number_settings,
            achievements: self.chit_events.achievements(Some(updates_since)),
            achievements_last_seen: (self.achievements_last_seen > updates_since).then_some(self.achievements_last_seen),
            total_chit_earned: self.chit_events.total_chit_earned(),
            chit_balance: self.chit_events.chit_balance(),
            streak: self.streak.days(now),
            streak_ends: self.streak.ends(),
            max_streak: self.streak.max_streak(),
            streak_insurance: if streak_insurance_updated {
                OptionUpdate::from_update(self.streak.streak_insurance(now))
            } else {
                OptionUpdate::NoChange
            },
            next_daily_claim: self.streak.next_claim(),
            is_unique_person: is_unique_person_updated.then_some(true),
            wallet_config,
            referrals,
            message_activity_summary,
            bots_added_or_updated,
            bots_removed,
            btc_address: btc_address_if_updated,
            one_sec_address: one_sec_address_if_updated,
            premium_items: premium_items_updated.then(|| self.premium_items.item_ids()),
            pinned_chats,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    // Reading the time marks a query's response as uncacheable, so a user with nothing new must
    // be told so without it
    #[test]
    fn updates_leaves_the_clock_alone_when_there_is_nothing_new() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

        let my_user_id: UserId = Principal::from_slice(&[1, 2, 3]).into();
        let user = User::new(Principal::from_slice(&[9]), "username".to_string(), None, 100);

        assert!(
            user.updates(100, my_user_id, || panic!("The clock was read with nothing to report"))
                .is_none()
        );
        // Registering set the username, so there is something to report from before then
        assert!(user.updates(99, my_user_id, || 200).is_some_and(|r| r.timestamp == 200));
    }
}
