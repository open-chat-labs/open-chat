use candid::Principal;
use direct_chat::DirectChats;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::collections::HashSet;
use types::{
    Achievement, Chat, ChatId, ChitEvent, ChitEventType, CommunityId, MultiUserChat, TimestampMillis, Timestamped, UserId,
};
use user_canister::{MessageActivityEvent, WalletConfig};
use user_state::{
    BlockedUsers, ChitEvents, Communities, Community, Contacts, FavouriteChats, GameChitKeys, GroupChat, GroupChats,
    HotGroupExclusions, Membership, MessageActivityEvents, PinNumber, ProfileDocument, SavedCryptoAccounts, Streak,
    ThreadsRead,
};

// The state of a single user within the canister. This mirrors the per-user fields of the User
// canister's `Data`, using the same names and types, so that the logic of each endpoint can be
// shared and a user could later be moved between the two kinds of canister.
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
        }
    }

    pub fn membership(&self, now: TimestampMillis) -> Membership {
        Membership::new(self.diamond_membership_expires_at, now)
    }

    // Removes the group, returning the prefix of its entries in the stable memory map, which the
    // caller garbage collects, as the User canister's `remove_group` does
    pub fn remove_group(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<(GroupChat, BaseKeyPrefix)> {
        self.favourite_chats.remove(&Chat::Group(chat_id), now);
        self.hot_group_exclusions.add(chat_id, None, now);
        let group = self.group_chats.remove(chat_id, now)?;
        Some((group, ThreadsRead::stable_memory_key_prefix(MultiUserChat::Group(chat_id))))
    }

    // Removes the community, returning the prefixes of its channels' entries in the stable memory
    // map, which the caller garbage collects, as the User canister's `remove_community` does
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

    // Adds an event to the user's message activity feed, unless it was caused by a user they have
    // blocked
    pub fn push_message_activity(&mut self, event: MessageActivityEvent, now: TimestampMillis) {
        if event.user_id.is_none_or(|user_id| !self.blocked_users.contains(&user_id)) {
            self.message_activity_events.push(event, now);
        }
    }
}
