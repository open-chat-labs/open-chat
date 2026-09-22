use crate::{
    BlockedUsers, ChitEvents, Communities, Community, Contacts, FavouriteChats, GameChitKeys, GroupChat, GroupChats,
    HotGroupExclusions, Membership, MessageActivityEvents, PinNumber, ProfileDocument, Referrals, SavedCryptoAccounts, Streak,
    ThreadsRead,
};
use candid::Principal;
use direct_chat::DirectChats;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::collections::HashSet;
use types::{
    Achievement, Chat, ChatId, ChitEvent, ChitEventType, CommunityId, MultiUserChat, ReferralStatus, TimestampMillis,
    Timestamped, UniquePersonProof, UserId,
};
use user_canister::{MessageActivityEvent, WalletConfig};

// The state of a single user, shared by the User canister, which holds one, and the MultiUser
// canister, which holds many, so that the logic of each endpoint can be shared and a user could
// later be moved between the two kinds of canister.
//
// In the MultiUser canister any stable memory map entries a user holds are keyed under that user's
// index, so there a `User` must only be accessed within its key scope, which `Users` takes care of.
#[derive(Serialize, Deserialize)]
pub struct User {
    // The User canister serialized this as `owner`
    #[serde(alias = "owner")]
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
}

impl User {
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
        }
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
    // `SetReferralStatus` event, returning whether CHIT was awarded for it
    pub fn set_referral_status(&mut self, user_id: UserId, status: ReferralStatus, now: TimestampMillis) -> bool {
        let chit_reward = self.referrals.set_status(user_id, status, now);
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
