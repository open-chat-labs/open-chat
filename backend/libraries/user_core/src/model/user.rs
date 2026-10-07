use crate::{
    BlockedUsers, ChitEvents, Communities, Community, Contacts, FavouriteChats, GameChitKeys, GroupChat, GroupChats,
    HotGroupExclusions, Membership, MessageActivityEvents, P2PSwaps, PinNumber, PremiumItems, ProfileDocument, Referrals,
    SavedCryptoAccounts, Streak, ThreadsRead, TokenSwaps,
};
use candid::Principal;
use constants::{MAX_WALLET_TOKENS, OPENCHAT_BOT_USER_ID};
use direct_chat::{DirectChat, DirectChats};
use installed_bots::InstalledBots;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::collections::HashSet;
use types::{
    Achievement, BotDefinitionUpdate, BotInitiator, BotPermissions, BotUpdated, CanisterId, Chat, ChatId, ChitEvent,
    ChitEventType, CommunityId, MultiUserChat, ReferralStatus, TimestampMillis, Timestamped, UniquePersonProof, UserId,
};
use user_canister::{MessageActivityEvent, WalletConfig};
use utils::migrated_user_ids::MigratedUserIds;

// The state of a single user, shared by the User canister, which holds one, and the MultiUser
// canister, which holds many, so that the logic of each endpoint can be shared and a user could
// later be moved between the two kinds of canister.
//
// In the MultiUser canister any stable memory map entries a user holds are keyed under that user's
// index, so there a `User` must only be accessed within its key scope, which `Users` takes care of.
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

impl User {
    // Moves what the user holds under their own id onto their new id once they are migrated from a
    // canister of their own to a MultiUser canister
    pub fn migrate_own_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        self.direct_chats.migrate_own_user_id(old_user_id, new_user_id);
        self.favourite_chats.migrate_own_user_id(old_user_id, new_user_id);
        // The deposit addresses were generated for the account of the user's old canister, so new
        // ones are generated for the user's own account when next asked for
        self.btc_address = None;
        self.one_sec_address = None;
    }

    // Moves what the user holds under the id of another user onto that user's new id once they are
    // migrated to a MultiUser canister: their chat with them, their block of them and their contact
    // for them. Messages keep the id they were sent under.
    pub fn migrate_their_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) {
        if self.blocked_users.unblock(old_user_id, now) {
            self.blocked_users.block(new_user_id, now);
        }
        if self.direct_chats.migrate_their_user_id(old_user_id, new_user_id, now) {
            self.favourite_chats.migrate_their_user_id(old_user_id, new_user_id, now);
        }
        self.contacts.migrate_user_id(old_user_id, new_user_id);
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

    // The users the user has, or had, a direct chat with, other than themselves and bots, who are
    // told of the user's new id once they are migrated to a MultiUser canister
    pub fn direct_chat_user_ids(&self, my_user_id: UserId) -> Vec<UserId> {
        let mut user_ids: HashSet<UserId> = self
            .direct_chats
            .iter()
            .filter(|chat| !chat.user_type.is_bot())
            .map(|chat| chat.them)
            .collect();
        // A chat removed by the user is still held by the other user
        user_ids.extend(self.direct_chats.removed_since(0).into_iter().map(UserId::from));
        user_ids.remove(&my_user_id);
        user_ids.into_iter().collect()
    }

    // The canisters of the groups and communities the user is in
    pub fn group_and_community_canisters(&self) -> Vec<CanisterId> {
        self.group_chats
            .ids()
            .map(CanisterId::from)
            .chain(self.communities.ids().map(CanisterId::from))
            .collect()
    }

    // Moves every direct chat, group and community still on the heap into stable memory, returning
    // how many were moved
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        self.direct_chats.migrate_to_stable_memory()
            + self.group_chats.migrate_to_stable_memory()
            + self.communities.migrate_to_stable_memory()
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

    // Blocks the user with the given id, returning false if they were already blocked. The caller
    // tells the LocalUserIndex (`UserBlocked`) if the user is newly blocked, as the User canister does.
    pub fn block_user(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        self.blocked_users.block(user_id, now)
    }

    // Unblocks the user with the given id, returning false if they weren't blocked. The caller tells
    // the LocalUserIndex (`UserUnblocked`) if the user is newly unblocked.
    pub fn unblock_user(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        self.blocked_users.unblock(user_id, now)
    }

    // Awards the achievement along with its CHIT, returning false if the user already had it. The
    // caller tells the LocalUserIndex of the user's new CHIT balance, as the User canister does.
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

    // As the User canister's `award_external_achievement`, returning whether it was newly awarded
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

    // Records the status a user this user referred has reached, as the User canister does on a
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
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::UserType;
    use user_canister::ManualWallet;

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
}
