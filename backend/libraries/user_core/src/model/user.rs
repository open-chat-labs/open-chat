use crate::mentions::replace_mentioned_users;
use crate::{
    BlockedUsers, ChitEvents, Communities, Community, Contacts, FavouriteChats, GameChitKeys, GroupChat, GroupChats,
    HotGroupExclusions, Membership, MessageActivityEvents, P2PSwaps, PinNumber, PremiumItems, ProfileDocument, Referrals,
    SavedCryptoAccounts, Streak, ThreadsRead, TokenSwaps,
};
use candid::Principal;
use constants::{MAX_WALLET_TOKENS, OPENCHAT_BOT_USER_ID};
use direct_chat::{DirectChat, DirectChats};
use installed_bots::InstalledBots;
use multi_user_canister::{MessageActivityEvent, WalletConfig};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::collections::HashSet;
use types::{
    Achievement, BotDefinitionUpdate, BotInitiator, BotPermissions, BotUpdated, Chat, ChatId, ChitEvent, ChitEventType,
    CommunityId, MultiUserChat, ReferralStatus, TimestampMillis, Timestamped, UniquePersonProof, UserId,
};
use utils::migrated_user_ids::MigratedUserIds;

// The state of a single user, many of whom are held in each MultiUser canister.
//
// Any stable memory map entries a user holds are keyed under that user's index, so a `User` must
// only be accessed within its key scope, which `Users` takes care of.
#[derive(Serialize, Deserialize)]
pub struct User {
    pub principal: Principal,
    pub username: Timestamped<String>,
    pub display_name: Timestamped<Option<String>>,
    pub bio: Timestamped<String>,
    pub avatar: ProfileDocument,
    pub profile_background: ProfileDocument,
    pub user_created: TimestampMillis,
    pub suspended: Timestamped<bool>,
    pub referred_by: Option<UserId>,
    #[serde(default)]
    pub hot_group_exclusions: HotGroupExclusions,
    #[serde(default)]
    pub saved_crypto_accounts: SavedCryptoAccounts,
    #[serde(default)]
    pub pin_number: PinNumber,
    pub direct_chats: DirectChats,
    pub favourite_chats: FavouriteChats,
    pub blocked_users: BlockedUsers,
    pub contacts: Contacts,
    pub wallet_config: Timestamped<WalletConfig>,
    #[serde(default)]
    pub message_activity_events: MessageActivityEvents,
    // When the earliest event due to expire in any of the user's direct chats expires, which is
    // when the job to remove the user's expired events next runs
    #[serde(default)]
    pub next_event_expiry: Option<TimestampMillis>,
    #[serde(default)]
    pub chit_events: ChitEvents,
    #[serde(default)]
    pub streak: Streak,
    #[serde(default)]
    pub achievements: HashSet<Achievement>,
    #[serde(default)]
    pub achievements_last_seen: TimestampMillis,
    #[serde(default)]
    pub game_chit_keys: GameChitKeys,
    #[serde(default)]
    pub group_chats: GroupChats,
    #[serde(default)]
    pub communities: Communities,
    #[serde(default)]
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    #[serde(default)]
    pub phone_is_verified: bool,
    #[serde(default)]
    pub storage_limit: u64,
    #[serde(default)]
    pub unique_person_proof: Option<UniquePersonProof>,
    #[serde(default)]
    pub external_achievements: HashSet<String>,
    #[serde(default)]
    pub referrals: Referrals,
    #[serde(default)]
    pub is_platform_moderator: bool,
    #[serde(default)]
    pub token_swaps: TokenSwaps,
    #[serde(default)]
    pub p2p_swaps: P2PSwaps,
    #[serde(default)]
    pub btc_address: Option<Timestamped<String>>,
    #[serde(default)]
    pub one_sec_address: Option<Timestamped<String>>,
    #[serde(default)]
    pub bots: InstalledBots,
    #[serde(default)]
    pub premium_items: PremiumItems,
}

// Every id the user with `user_id` has had which `migrated_user_ids` knows of, latest last
pub(crate) fn all_ids_of(user_id: UserId, migrated_user_ids: &MigratedUserIds) -> Vec<UserId> {
    let latest = migrated_user_ids.latest(user_id);
    let mut user_ids = migrated_user_ids.previous_ids(latest);
    user_ids.push(latest);
    user_ids
}

// How much `User::migrate_user_ids` moved onto users' latest ids
#[derive(Default, Debug, PartialEq, Eq)]
pub struct UserIdsMigrated {
    // The ids found to have been migrated which the user held a chat, pin, favourite, block or
    // contact under
    pub old_user_ids_found: u32,
    // How many of those chats were left under the old id, since the user already had a chat under
    // the other user's latest id (see `DirectChats::migrate_their_user_id`)
    pub chats_left_under_old_ids: u32,
    // Who referred the user, and the users they referred
    pub referrals: u32,
    pub message_activity_events: u32,
    pub private_replies: u32,
    // The chats whose latest change to their TTL, or whose metrics, were updated
    pub direct_chats: u32,
    pub bots: u32,
    // Whether any mentions in the user's bio were
    pub bio: bool,
}

impl User {
    // Moves what the user holds under the id of another user onto that user's new id once they are
    // migrated to a MultiUser canister: their chat with them, their pin and favourite of it, their
    // block of them and their contact for them. A pin or favourite of a chat which doesn't exist,
    // which either can be, is moved too. The ids in the chat's events are replaced separately, by
    // the MultiUser canister's `update_user_ids_in_events` job.
    pub fn migrate_their_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) {
        if self.blocked_users.unblock(old_user_id, now) {
            self.blocked_users.block(new_user_id, now);
        }
        self.direct_chats.migrate_their_user_id(old_user_id, new_user_id, now);
        // Unless the chat was left under the old id, since there is one under the new id too
        if !self.direct_chats.exists(&old_user_id.into()) {
            self.favourite_chats.migrate_their_user_id(old_user_id, new_user_id, now);
        }
        self.contacts.migrate_user_id(old_user_id, new_user_id);
    }

    // Moves everything the user holds outside their direct chats' events under ids which they, or
    // other users, had before being migrated to a MultiUser canister onto those users' latest ids,
    // or, for something which names a direct chat, onto the id the chat is under now (see
    // `DirectChats::latest_user_id`). `migrated_user_ids` must know the migrations of the ids
    // `their_user_ids` returns, and of the user's own previous ids.
    pub fn migrate_user_ids(
        &mut self,
        my_user_id: UserId,
        migrated_user_ids: &MigratedUserIds,
        now: TimestampMillis,
    ) -> UserIdsMigrated {
        let mut migrated = UserIdsMigrated::default();
        for old_user_id in self.ids_of_users_with_chats_blocks_or_contacts() {
            if let Some(latest) = migrated_user_ids.get(&old_user_id) {
                self.migrate_their_user_id(old_user_id, latest, now);
                migrated.old_user_ids_found += 1;
                if self.direct_chats.exists(&old_user_id.into()) {
                    migrated.chats_left_under_old_ids += 1;
                }
            }
        }
        if let Some(latest) = self.referred_by.and_then(|user_id| migrated_user_ids.get(&user_id)) {
            self.referred_by = Some(latest);
            migrated.referrals += 1;
        }
        migrated.referrals += self.referrals.migrate_user_ids(migrated_user_ids, now);
        let direct_chats = &self.direct_chats;
        migrated.message_activity_events = self.message_activity_events.migrate_user_ids(
            |chat| direct_chats.latest_chat(chat, migrated_user_ids),
            |user_id| migrated_user_ids.latest(user_id),
            now,
        );
        migrated.private_replies = self.direct_chats.migrate_private_reply_user_ids(migrated_user_ids);
        migrated.direct_chats = self.direct_chats.migrate_user_ids_in_chats(my_user_id, migrated_user_ids);
        migrated.bots = self
            .bots
            .migrate_added_by(&migrated_user_ids.previous_ids(my_user_id), my_user_id, now);
        if let Some(bio) = replace_mentioned_users(&self.bio.value, |user_id| migrated_user_ids.latest(user_id)) {
            self.bio = Timestamped::new(bio, now);
            migrated.bio = true;
        }
        migrated
    }

    // The ids of the other users whom the user holds anything under which `migrate_user_ids` moves
    // onto their latest ids. Those which have been migrated are found from these.
    pub fn their_user_ids(&self) -> HashSet<UserId> {
        let mut user_ids = self.ids_of_users_with_chats_blocks_or_contacts();
        user_ids.extend(self.referred_by);
        user_ids.extend(self.referrals.user_ids());
        user_ids.extend(self.message_activity_events.user_ids());
        user_ids.extend(self.direct_chats.private_reply_user_ids());
        replace_mentioned_users(&self.bio.value, |user_id| {
            user_ids.insert(user_id);
            user_id
        });
        user_ids
    }

    // The ids of the other users whom the user has a direct chat with, or a pin or favourite of a
    // direct chat with, or has blocked or holds a contact for
    fn ids_of_users_with_chats_blocks_or_contacts(&self) -> HashSet<UserId> {
        let pinned = self.direct_chats.pinned_chats().into_keys();
        let favourites = self
            .favourite_chats
            .chats()
            .iter()
            .chain(self.favourite_chats.pinned().keys());
        self.direct_chats
            .ids()
            .map(UserId::from)
            .chain(
                pinned
                    .chain(favourites.copied())
                    .filter_map(|chat| if let Chat::Direct(chat_id) = chat { Some(chat_id.into()) } else { None }),
            )
            .chain(self.blocked_users.all())
            .chain(self.contacts.all().into_iter().map(|(user_id, _)| user_id))
            .collect()
    }

    // Moves what the user holds under the previous ids a sender's MultiUser canister sent with their
    // event onto the sender's id, before the event is applied, in case the notice of the sender's
    // migration hasn't arrived yet. The ids, oldest first, are recorded in `migrated_user_ids`
    // first, and an id is only moved if it now leads to the sender. Only what this is needed for, the
    // chat and a block, is checked for, since this runs for every such event.
    pub fn migrate_sender_user_id(
        &mut self,
        sender: UserId,
        sender_previous_user_ids: &[UserId],
        migrated_user_ids: &MigratedUserIds,
        now: TimestampMillis,
    ) {
        for &previous_user_id in sender_previous_user_ids {
            if migrated_user_ids.latest(previous_user_id) == sender
                && (self.direct_chats.exists(&previous_user_id.into()) || self.blocked_users.contains(&previous_user_id))
            {
                self.migrate_their_user_id(previous_user_id, sender, now);
            }
        }
    }

    pub fn new(principal: Principal, username: String, referred_by: Option<UserId>, now: TimestampMillis) -> User {
        User {
            principal,
            username: Timestamped::new(username, now),
            display_name: Timestamped::default(),
            bio: Timestamped::new(String::new(), now),
            avatar: ProfileDocument::default(),
            profile_background: ProfileDocument::default(),
            user_created: now,
            suspended: Timestamped::default(),
            referred_by,
            hot_group_exclusions: HotGroupExclusions::default(),
            saved_crypto_accounts: SavedCryptoAccounts::default(),
            pin_number: PinNumber::default(),
            direct_chats: DirectChats::default(),
            favourite_chats: FavouriteChats::default(),
            blocked_users: BlockedUsers::default(),
            contacts: Contacts::default(),
            wallet_config: Timestamped::default(),
            message_activity_events: MessageActivityEvents::default(),
            next_event_expiry: None,
            chit_events: ChitEvents::default(),
            streak: Streak::default(),
            achievements: HashSet::new(),
            achievements_last_seen: 0,
            game_chit_keys: GameChitKeys::default(),
            group_chats: GroupChats::default(),
            communities: Communities::default(),
            diamond_membership_expires_at: None,
            phone_is_verified: false,
            storage_limit: 0,
            unique_person_proof: None,
            external_achievements: HashSet::new(),
            referrals: Referrals::default(),
            is_platform_moderator: false,
            token_swaps: TokenSwaps::default(),
            p2p_swaps: P2PSwaps::default(),
            btc_address: None,
            one_sec_address: None,
            bots: InstalledBots::default(),
            premium_items: PremiumItems::default(),
        }
    }

    pub fn is_bot_permitted(&self, bot_id: &UserId, initiator: &BotInitiator, required: BotPermissions) -> bool {
        // Try to get the installed bot
        let Some(bot) = self.bots.get(bot_id) else {
            return false;
        };

        // Get the granted permissions when initiated by command or API key
        let granted = match initiator {
            BotInitiator::Command(_) => {
                &BotPermissions::union(&bot.permissions, &bot.autonomous_permissions.clone().unwrap_or_default())
            }
            BotInitiator::Autonomous => match bot.autonomous_permissions.as_ref() {
                Some(permissions) => permissions,
                None => return false,
            },
        };

        // The permissions required must be a subset of the permissions granted to the bot
        required.is_subset(granted)
    }

    pub fn handle_bot_definition_updated(&mut self, update: BotDefinitionUpdate, now: TimestampMillis) {
        let bot_id = update.bot_id;

        if self.bots.update_from_definition(update, now) {
            self.apply_bot_update(bot_id, Some(OPENCHAT_BOT_USER_ID), now);
        }
    }

    pub fn update_bot_permissions(
        &mut self,
        bot_id: UserId,
        command_permissions: BotPermissions,
        autonomous_permissions: Option<BotPermissions>,
        now: TimestampMillis,
    ) -> bool {
        if self
            .bots
            .update_permissions(bot_id, command_permissions, autonomous_permissions, now)
        {
            self.apply_bot_update(bot_id, None, now);
            true
        } else {
            false
        }
    }

    // Reinstates the daily claims the user missed, returning how many were and the streak this
    // leaves them with
    pub fn reinstate_missed_daily_claims(&mut self, days_to_reinstate: Vec<u16>, now: TimestampMillis) -> (usize, u16) {
        let daily_claims = self.chit_events.daily_claims();
        let new_events = self
            .streak
            .reinstate_missed_daily_claims(days_to_reinstate, daily_claims, now);
        let count = new_events.len();
        for event in new_events {
            self.chit_events.push(event);
        }
        (count, self.streak.days(now))
    }

    // Removes the bot and the user's chat with it, returning the chat's stable memory prefixes for
    // the caller to garbage collect
    pub fn uninstall_bot(&mut self, bot_id: UserId, now: TimestampMillis) -> Vec<BaseKeyPrefix> {
        self.bots.remove(bot_id, now);
        self.remove_direct_chat(bot_id, now)
            .map(|chat| chat.stable_memory_key_prefixes())
            .unwrap_or_default()
    }

    // Removes the user's chat with `them`, along with its pin and their favourite of it
    pub fn remove_direct_chat(&mut self, them: UserId, now: TimestampMillis) -> Option<DirectChat> {
        self.favourite_chats.remove(&Chat::Direct(them.into()), now);
        self.direct_chats.remove(them.into(), now)
    }

    // Sets the wallet config, keeping at most `MAX_WALLET_TOKENS` distinct tokens in a manual wallet.
    // Any more are dropped rather than the config being rejected, since there are far fewer tokens.
    pub fn set_wallet_config(&mut self, mut config: WalletConfig, now: TimestampMillis) {
        if let WalletConfig::Manual(manual) = &mut config {
            let mut seen = HashSet::new();
            manual.tokens.retain(|token| seen.insert(*token));
            manual.tokens.truncate(MAX_WALLET_TOKENS);
        }
        self.wallet_config = Timestamped::new(config, now);
    }

    fn apply_bot_update(&mut self, bot_id: UserId, updated_by: Option<UserId>, now: TimestampMillis) {
        // The user may have deleted their chat with the bot while keeping it installed
        let Some(mut chat) = self.direct_chats.get_mut(&bot_id.into()) else {
            return;
        };

        // Push a chat event
        if let Some(updated_by) = updated_by {
            chat.push_bot_updated_event(
                BotUpdated {
                    user_id: bot_id,
                    updated_by,
                },
                now,
            );
        }

        // Re-apply event subscriptions given the changes to permissions and/or subscriptions
        let bot = self.bots.get(&bot_id).unwrap();

        let permissions = &bot.autonomous_permissions.clone().unwrap_or_default();
        let permitted_categories = permissions.permitted_chat_event_categories_to_read();
        let subscriptions = bot.default_subscriptions.clone().unwrap_or_default();

        chat.subscribe_bot_to_events(bot_id, subscriptions.chat, &permitted_categories);
    }

    pub fn membership(&self, now: TimestampMillis) -> Membership {
        Membership::new(self.diamond_membership_expires_at, now)
    }

    // Removes the group, returning the prefix of its entries in the stable memory map, which the
    // caller garbage collects
    pub fn remove_group(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<(GroupChat, BaseKeyPrefix)> {
        self.favourite_chats.remove(&Chat::Group(chat_id), now);
        self.hot_group_exclusions.add(chat_id, None, now);
        let group = self.group_chats.remove(chat_id, now)?;
        Some((group, ThreadsRead::stable_memory_key_prefix(MultiUserChat::Group(chat_id))))
    }

    // Removes the community, returning the prefixes of its channels' entries in the stable memory
    // map, which the caller garbage collects
    pub fn remove_community(
        &mut self,
        community_id: CommunityId,
        now: TimestampMillis,
    ) -> Option<(Community, Vec<BaseKeyPrefix>)> {
        let community = self.communities.remove(community_id, now)?;
        let mut prefixes = Vec::new();
        for channel_id in community.channels.keys() {
            self.favourite_chats.remove(&Chat::Channel(community_id, *channel_id), now);
            prefixes.push(ThreadsRead::stable_memory_key_prefix(MultiUserChat::Channel(
                community_id,
                *channel_id,
            )));
        }
        Some((community, prefixes))
    }

    pub fn verify_not_suspended(&self) -> Result<(), OCErrorCode> {
        if self.suspended.value { Err(OCErrorCode::InitiatorSuspended) } else { Ok(()) }
    }

    // Blocks the user under their latest id, since a client which hasn't yet heard that they have
    // been migrated to a MultiUser canister names them by the id they had before, as does the chat
    // with them if it was left under that id (see `DirectChats::migrate_their_user_id`). Returns
    // the id they were blocked under, or None if they already were. The caller tells the
    // LocalUserIndex (`UserBlocked`).
    pub fn block_user(&mut self, user_id: UserId, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> Option<UserId> {
        let latest = migrated_user_ids.latest(user_id);
        self.blocked_users.block(latest, now).then_some(latest)
    }

    // Unblocks the user under every id they have had, since a block can still be under an id they
    // had before being migrated until the `migrate_their_user_ids` job reaches the user. Returns the
    // ids they were unblocked under, which the caller tells the LocalUserIndex of (`UserUnblocked`).
    pub fn unblock_user(&mut self, user_id: UserId, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> Vec<UserId> {
        all_ids_of(user_id, migrated_user_ids)
            .into_iter()
            .filter(|user_id| self.blocked_users.unblock(*user_id, now))
            .collect()
    }

    // Whether the user has blocked `user_id`, under that id or the latest id they have been
    // migrated to (see `block_user`)
    pub fn has_blocked(&self, user_id: UserId, migrated_user_ids: &MigratedUserIds) -> bool {
        self.blocked_users.contains(&user_id) || {
            let latest = migrated_user_ids.latest(user_id);
            latest != user_id && self.blocked_users.contains(&latest)
        }
    }

    // Awards the achievement along with its CHIT, returning false if the user already had it. The
    // caller tells the LocalUserIndex of the user's new CHIT balance.
    pub fn award_achievement(&mut self, achievement: Achievement, now: TimestampMillis) -> bool {
        if self.achievements.insert(achievement) {
            self.chit_events.push(ChitEvent {
                amount: achievement.chit_reward() as i32,
                timestamp: now,
                reason: ChitEventType::Achievement(achievement),
            });
            true
        } else {
            false
        }
    }

    // Awards the external achievement along with its CHIT, returning whether it was newly awarded
    pub fn award_external_achievement(&mut self, name: String, chit_reward: u32, now: TimestampMillis) -> bool {
        if self.external_achievements.insert(name.clone()) {
            self.chit_events.push(ChitEvent {
                amount: chit_reward as i32,
                timestamp: now,
                reason: ChitEventType::ExternalAchievement(name),
            });
            true
        } else {
            false
        }
    }

    // Records the status a user this user referred has reached, as sent in a
    // `SetReferralStatus` event, returning whether CHIT was awarded for it. `previous_user_ids` are
    // the ids the referred user had before being migrated to a MultiUser canister.
    pub fn set_referral_status(
        &mut self,
        user_id: UserId,
        previous_user_ids: &[UserId],
        status: ReferralStatus,
        now: TimestampMillis,
    ) -> bool {
        let chit_reward = self.referrals.set_status(user_id, previous_user_ids, status, now);
        let mut rewarded = false;

        if chit_reward > 0 {
            self.chit_events.push(ChitEvent {
                amount: chit_reward as i32,
                timestamp: now,
                reason: ChitEventType::Referral(status),
            });
            rewarded = true;
        }

        if let Some(achievement) = match self.referrals.total_verified() {
            1 => Some(Achievement::Referred1stUser),
            3 => Some(Achievement::Referred3rdUser),
            10 => Some(Achievement::Referred10thUser),
            20 => Some(Achievement::Referred20thUser),
            50 => Some(Achievement::Referred50thUser),
            _ => None,
        } {
            rewarded |= self.award_achievement(achievement, now);
        }

        rewarded
    }

    // Adds an event to the user's message activity feed, unless it was caused by a user they have
    // blocked
    pub fn push_message_activity(&mut self, event: MessageActivityEvent, now: TimestampMillis) {
        if event.user_id.is_none_or(|user_id| !self.blocked_users.contains(&user_id)) {
            self.message_activity_events.push(event, now);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chat_events::ChatInternal;
    use direct_chat::EventsTtlLatestChange;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use multi_user_canister::ManualWallet;
    use multi_user_canister::set_contact::OptionalContact;
    use std::collections::HashMap;
    use types::{CanisterId, OptionUpdate, UserType};

    #[test]
    fn manual_wallet_tokens_are_deduplicated_and_limited() {
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);
        let token = |i: u32| CanisterId::from_slice(&i.to_be_bytes());
        let tokens: Vec<_> = (0..MAX_WALLET_TOKENS as u32 + 10)
            .flat_map(|i| [token(i), token(i)])
            .collect();

        user.set_wallet_config(WalletConfig::Manual(ManualWallet { tokens }), 10);

        let WalletConfig::Manual(manual) = &user.wallet_config.value else {
            panic!("Not a manual wallet");
        };
        assert_eq!(manual.tokens, (0..MAX_WALLET_TOKENS as u32).map(token).collect::<Vec<_>>());
        assert_eq!(user.wallet_config.timestamp, 10);
    }

    #[test]
    fn removing_a_direct_chat_removes_its_pin_and_favourite() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        let me: UserId = Principal::from_slice(&[1; 10]).into();
        let them: UserId = Principal::from_slice(&[2; 10]).into();
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);
        user.direct_chats.get_or_create(me, them, UserType::User, || 1, 10);
        user.direct_chats.pin(them.into(), 20).unwrap();
        user.favourite_chats.pin(Chat::Direct(them.into()), 20).unwrap();

        assert!(user.remove_direct_chat(them, 30).is_some());

        assert!(user.direct_chats.pinned_chats().is_empty());
        assert!(user.favourite_chats.is_empty());
        assert!(user.favourite_chats.pinned().is_empty());
        assert!(user.remove_direct_chat(them, 40).is_none());
    }

    #[test]
    fn their_user_ids_are_every_id_of_another_user_held_outside_the_chats_events() {
        init_stable_memory_map();
        let me = user_id(1);
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), Some(user_id(12)), 0);
        user.direct_chats.get_or_create(me, user_id(2), UserType::User, || 1, 10);
        user.direct_chats.get_or_create(me, user_id(3), UserType::User, || 2, 10);
        user.blocked_users.block(user_id(3), 20);
        user.blocked_users.block(user_id(4), 20);
        set_contact(&mut user, user_id(5));
        // Pins and favourites of chats which don't exist
        user.direct_chats.pin(user_id(6).into(), 20).unwrap();
        user.favourite_chats.add(Chat::Direct(user_id(7).into()), 20).unwrap();
        user.favourite_chats.pin(Chat::Direct(user_id(8).into()), 20).unwrap();
        user.favourite_chats.add(group(), 20).unwrap();
        user.message_activity_events
            .push(activity_event(Chat::Direct(user_id(9).into()), 1, 30, user_id(10)), 30);
        user.direct_chats
            .mark_private_reply(user_id(11), ChatInternal::Group(group_id()), 1.into());
        user.referrals.set_status(user_id(13), &[], ReferralStatus::Registered, 40);
        user.bio = Timestamped::new(format!("Friend of @UserId({})", user_id(14)), 50);

        assert_eq!(user.their_user_ids(), (2..=14).map(user_id).collect());
    }

    #[test]
    fn everything_held_under_ids_from_before_a_migration_is_moved_onto_the_latest_ids() {
        init_stable_memory_map();
        let (me, my_old) = (user_id(1), user_id(101));
        let old = |i: u8| user_id(100 + i);
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(my_old, me);
        for i in 2..=9 {
            migrated_user_ids.insert(old(i), user_id(i));
        }
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), Some(old(2)), 0);
        // A pin and favourites of chats which don't exist
        user.direct_chats.pin(old(3).into(), 10).unwrap();
        user.favourite_chats.pin(Chat::Direct(old(3).into()), 10).unwrap();
        user.favourite_chats.add(Chat::Direct(old(4).into()), 10).unwrap();
        // A chat left under the old id, since there is one under the new id, is favourited under both
        user.direct_chats.get_or_create(me, old(5), UserType::User, || 1, 10);
        user.direct_chats.get_or_create(me, user_id(5), UserType::User, || 2, 10);
        user.favourite_chats.add(Chat::Direct(old(5).into()), 10).unwrap();
        user.favourite_chats.add(Chat::Direct(user_id(5).into()), 10).unwrap();
        user.referrals.set_status(old(6), &[], ReferralStatus::Diamond, 10);
        user.message_activity_events
            .push(activity_event(Chat::Direct(old(7).into()), 1, 10, old(7)), 10);
        user.direct_chats
            .mark_private_reply(old(8), ChatInternal::Group(group_id()), 1.into());
        user.direct_chats
            .get_or_create(me, user_id(9), UserType::User, || 3, 10)
            .set_events_time_to_live(old(9), Some(1000), 10);
        user.bots.add(user_id(50), my_old, BotPermissions::default(), None, None, 10);
        user.bio = Timestamped::new(format!("Friend of @UserId({}) and @UserId({})", old(2), user_id(3)), 10);

        let migrated = user.migrate_user_ids(me, &migrated_user_ids, 100);

        assert_eq!(user.referred_by, Some(user_id(2)));
        assert_eq!(
            user.direct_chats.pinned_chats(),
            HashMap::from([(Chat::Direct(user_id(3).into()), 10)])
        );
        assert_eq!(
            user.favourite_chats.chats(),
            &[
                Chat::Direct(user_id(5).into()),
                Chat::Direct(old(5).into()),
                Chat::Direct(user_id(4).into()),
                Chat::Direct(user_id(3).into()),
            ]
        );
        assert_eq!(
            user.favourite_chats.pinned().keys().collect::<Vec<_>>(),
            vec![&Chat::Direct(user_id(3).into())]
        );
        assert_eq!(user.referrals.user_ids(), vec![user_id(6)]);
        let event = user.message_activity_events.latest_events(0).pop().unwrap();
        assert_eq!(
            (event.chat, event.user_id),
            (Chat::Direct(user_id(7).into()), Some(user_id(7)))
        );
        assert_eq!(user.direct_chats.private_reply_user_ids(), HashSet::from([user_id(8)]));
        assert!(matches!(
            user.direct_chats.get(&user_id(9).into()).unwrap().events_ttl_latest_change(),
            EventsTtlLatestChange::Changed(change) if change.by == user_id(9)
        ));
        assert!(user.bots.get(&user_id(50)).is_some_and(|bot| bot.added_by == me));
        assert_eq!(
            user.bio,
            Timestamped::new(format!("Friend of @UserId({}) and @UserId({})", user_id(2), user_id(3)), 100)
        );
        assert_eq!(
            migrated,
            UserIdsMigrated {
                old_user_ids_found: 3,
                chats_left_under_old_ids: 1,
                referrals: 2,
                message_activity_events: 1,
                private_replies: 1,
                direct_chats: 1,
                bots: 1,
                bio: true,
            }
        );
        // Clients are sent what changed
        assert!(user.direct_chats.pinned_chats_if_updated(99).is_some());
        assert!(user.favourite_chats.any_updated(99));
        assert_eq!(user.referrals.updated_since(99).len(), 1);
        assert!(user.bots.last_updated() > 99);

        // Running again finds nothing more
        assert_eq!(
            user.migrate_user_ids(me, &migrated_user_ids, 200),
            UserIdsMigrated {
                old_user_ids_found: 1,
                chats_left_under_old_ids: 1,
                ..Default::default()
            }
        );
    }

    #[test]
    fn blocks_are_added_under_the_latest_id_and_removed_under_both() {
        init_stable_memory_map();
        let (old, latest, other) = (user_id(2), user_id(3), user_id(4));
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old, latest);
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);

        assert_eq!(user.block_user(old, &migrated_user_ids, 10), Some(latest));
        assert_eq!(user.block_user(latest, &migrated_user_ids, 10), None);
        assert_eq!(user.blocked_users.all(), vec![latest]);
        assert!(user.has_blocked(old, &migrated_user_ids));
        assert!(user.has_blocked(latest, &migrated_user_ids));
        assert!(!user.has_blocked(other, &migrated_user_ids));

        // A block still under the old id, before the user's blocks have been moved off it, is
        // removed too, whichever id they are named by
        for named_by in [old, latest] {
            user.blocked_users.block(old, 20);
            user.blocked_users.block(latest, 20);
            assert_eq!(user.unblock_user(named_by, &migrated_user_ids, 30), vec![old, latest]);
            assert!(!user.has_blocked(old, &migrated_user_ids));
            assert!(user.unblock_user(named_by, &migrated_user_ids, 40).is_empty());
        }
        user.blocked_users.block(other, 50);
        assert_eq!(user.unblock_user(other, &migrated_user_ids, 60), vec![other]);
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn group_id() -> ChatId {
        Principal::from_slice(&[200; 10]).into()
    }

    fn group() -> Chat {
        Chat::Group(group_id())
    }

    fn set_contact(user: &mut User, user_id: UserId) {
        user.contacts.set_contact(OptionalContact {
            user_id,
            nickname: OptionUpdate::SetToSome("nickname".to_string()),
        });
    }

    fn activity_event(chat: Chat, message_index: u32, timestamp: TimestampMillis, user_id: UserId) -> MessageActivityEvent {
        MessageActivityEvent {
            chat,
            thread_root_message_index: None,
            message_index: message_index.into(),
            message_id: (message_index as u64).into(),
            event_index: message_index.into(),
            activity: multi_user_canister::MessageActivity::Reaction,
            timestamp,
            user_id: Some(user_id),
        }
    }
}
