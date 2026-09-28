use ic_stable_structures::Storable;
use ic_stable_structures::storable::Bound;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

mod blocked_user;
mod chat_event;
mod chit_event;
mod community_event;
mod contact;
mod direct_chat_unread_message_index;
mod expiring_event;
mod last_updated;
mod macros;
mod message_activity_event;
mod message_event_indexes;
mod message_id;
mod p2p_swap;
mod principal;
mod private_reply;
mod profile_document;
mod referral;
mod removed_chat;
mod search_index;
mod storage;
mod streak_insurance;
mod thread_read;
mod token_swap;
mod user_id;
mod user_metrics;

pub use blocked_user::*;
pub use chat_event::*;
pub use chit_event::*;
pub use community_event::*;
pub use contact::*;
pub use direct_chat_unread_message_index::*;
pub use expiring_event::*;
pub use last_updated::*;
pub use message_activity_event::*;
pub use message_event_indexes::*;
pub use message_id::*;
pub use p2p_swap::*;
pub use principal::*;
pub use private_reply::*;
pub use profile_document::*;
pub use referral::*;
pub use removed_chat::*;
pub use search_index::*;
pub use storage::*;
pub use streak_insurance::*;
pub use thread_read::*;
pub use token_swap::*;
pub use user_id::*;
pub use user_metrics::*;

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[serde(transparent)]
pub struct BaseKey(#[serde(with = "serde_bytes")] Vec<u8>);

impl BaseKey {
    pub(crate) fn new(bytes: Vec<u8>) -> BaseKey {
        BaseKey(bytes)
    }

    pub fn matches_prefix(&self, prefix: &BaseKeyPrefix) -> bool {
        self.0.starts_with(prefix.0.as_slice())
    }

    pub fn as_slice(&self) -> &[u8] {
        self.0.as_slice()
    }

    pub(crate) fn into_vec(self) -> Vec<u8> {
        self.0
    }
}

impl Storable for BaseKey {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Borrowed(&self.0)
    }

    fn into_bytes(self) -> Vec<u8> {
        self.0
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        BaseKey(bytes.to_vec())
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl From<BaseKeyPrefix> for BaseKey {
    fn from(value: BaseKeyPrefix) -> Self {
        BaseKey(value.0)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[serde(transparent)]
pub struct BaseKeyPrefix(#[serde(with = "serde_bytes")] Vec<u8>);

impl BaseKeyPrefix {
    pub fn as_slice(&self) -> &[u8] {
        self.0.as_slice()
    }
}

pub trait Key: Into<BaseKey> + TryFrom<BaseKey> + Clone + AsRef<[u8]> {
    type Prefix: KeyPrefix<Key = Self>;

    fn matches_prefix(&self, key: &Self::Prefix) -> bool;
}

pub trait KeyPrefix: Into<BaseKeyPrefix> + TryFrom<BaseKeyPrefix> + Clone {
    type Key: Key<Prefix = Self>;
    type Suffix: Clone;

    fn create_key(&self, value: &Self::Suffix) -> Self::Key;
}

fn validate_key<F: FnOnce(KeyType) -> bool>(key: &[u8], validator: F) -> Result<(), String> {
    if extract_key_type(key).is_some_and(validator) {
        Ok(())
    } else {
        Err(format!("Key type mismatch: {:?}", key.first()))
    }
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum KeyType {
    // The events of direct chats created before `key_id`s were introduced stay under these two
    // `Legacy` key types until they have been moved across to `DirectChatEvent` and
    // `DirectChatThreadEvent`. Both can be removed once every user canister has been migrated.
    DirectChatEventLegacy = 1,
    GroupChatEvent = 2,
    ChannelEvent = 3,
    DirectChatThreadEventLegacy = 4,
    GroupChatThreadEvent = 5,
    ChannelThreadEvent = 6,
    GroupMember = 7,
    ChannelMember = 8,
    CommunityMember = 9,
    CommunityEvent = 10,
    PrincipalToUserId = 11,
    FileIdToFile = 12,
    FileReferenceCount = 13,
    FilesPerAccessor = 14,
    UserStorageRecord = 15,
    BlockedUsers = 16,
    DirectChatMessageId = 17,
    GroupChatMessageId = 18,
    ChannelMessageId = 19,
    DirectChatThreadMessageId = 20,
    GroupChatThreadMessageId = 21,
    ChannelThreadMessageId = 22,
    DirectChatExpiringEvent = 23,
    GroupChatExpiringEvent = 24,
    ChannelExpiringEvent = 25,
    DirectChatEventLastUpdated = 26,
    GroupChatEventLastUpdated = 27,
    ChannelEventLastUpdated = 28,
    DirectChatEventsByLastUpdated = 29,
    GroupChatEventsByLastUpdated = 30,
    ChannelEventsByLastUpdated = 31,
    DirectChatUserMetrics = 32,
    GroupChatUserMetrics = 33,
    ChannelUserMetrics = 34,
    DirectChatMessageEventIndexes = 35,
    GroupChatMessageEventIndexes = 36,
    ChannelMessageEventIndexes = 37,
    DirectChatThreadMessageEventIndexes = 38,
    GroupChatThreadMessageEventIndexes = 39,
    ChannelThreadMessageEventIndexes = 40,
    DirectChatSearchToken = 41,
    GroupChatSearchToken = 42,
    ChannelSearchToken = 43,
    DirectChatSearchSender = 44,
    GroupChatSearchSender = 45,
    ChannelSearchSender = 46,
    MessageActivityEvent = 47,
    MessageActivityEventId = 48,
    ChitEvent = 49,
    GroupThreadRead = 50,
    ChannelThreadRead = 51,
    TokenSwap = 52,
    P2PSwap = 53,
    Referral = 54,
    StreakInsurancePayment = 55,
    StreakInsuranceClaim = 56,
    // Every direct chat key type other than the two `Legacy` ones uses the chat's `key_id` in place
    // of the other user's id (see `ChatEventKeyPrefix::new_from_direct_chat_key_id`). The events
    // need new key types since the legacy entries are still being migrated, whereas the other key
    // types never held data in the legacy layout so they keep their original values.
    DirectChatEvent = 57,
    DirectChatThreadEvent = 58,
    Contact = 59,
    BlockedUser = 60,
    DirectChatUnreadMessageIndex = 61,
    DirectChatRemoved = 62,
    GroupChatRemoved = 63,
    CommunityRemoved = 64,
    ProfileDocument = 65,
    PrivateReplyToGroup = 66,
    #[cfg(test)]
    TestSmallEntries = 255,
}

// Which of the two underlying maps a key type's entries are stored in
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MapClass {
    // The main map, which uses the default page size of 1024 bytes
    Default,
    // The map for small entries, which uses pages of `SMALL_ENTRIES_MAP_PAGE_SIZE` bytes
    SmallEntries,
}

impl KeyType {
    // Once a canister holds data under a key type, that key type's class must never change, since
    // its existing entries would no longer be found. Every key type up to `BlockedUsers` already holds
    // data in the main map in production, so they must all stay as `Default`.
    //
    // All key types sharing a `KeyPrefix` must have the same class, so that a range over a prefix
    // stays within one map.
    pub const fn map_class(self) -> MapClass {
        match self {
            KeyType::DirectChatEventLegacy
            | KeyType::GroupChatEvent
            | KeyType::ChannelEvent
            | KeyType::DirectChatThreadEventLegacy
            | KeyType::GroupChatThreadEvent
            | KeyType::ChannelThreadEvent
            | KeyType::DirectChatEvent
            | KeyType::DirectChatThreadEvent
            | KeyType::GroupMember
            | KeyType::ChannelMember
            | KeyType::CommunityMember
            | KeyType::CommunityEvent
            | KeyType::PrincipalToUserId
            | KeyType::FileIdToFile
            | KeyType::FileReferenceCount
            | KeyType::FilesPerAccessor
            | KeyType::UserStorageRecord
            | KeyType::BlockedUsers
            // Each entry is a chunk of event indexes, which is too large for the small entries map
            | KeyType::DirectChatMessageEventIndexes
            | KeyType::GroupChatMessageEventIndexes
            | KeyType::ChannelMessageEventIndexes
            | KeyType::DirectChatThreadMessageEventIndexes
            | KeyType::GroupChatThreadMessageEventIndexes
            | KeyType::ChannelThreadMessageEventIndexes
            // Each entry is a token swap, which is too large for the small entries map
            | KeyType::TokenSwap
            // Each entry is a P2P swap, which is too large for the small entries map
            | KeyType::P2PSwap
            // Contacts are expected to gain more fields, so they use the main map to leave room to grow
            | KeyType::Contact
            // Each entry is an avatar or profile background, which can be up to 1MB
            | KeyType::ProfileDocument => MapClass::Default,
            KeyType::DirectChatMessageId
            | KeyType::GroupChatMessageId
            | KeyType::ChannelMessageId
            | KeyType::DirectChatThreadMessageId
            | KeyType::GroupChatThreadMessageId
            | KeyType::ChannelThreadMessageId
            | KeyType::DirectChatExpiringEvent
            | KeyType::GroupChatExpiringEvent
            | KeyType::ChannelExpiringEvent
            | KeyType::DirectChatEventLastUpdated
            | KeyType::GroupChatEventLastUpdated
            | KeyType::ChannelEventLastUpdated
            | KeyType::DirectChatEventsByLastUpdated
            | KeyType::GroupChatEventsByLastUpdated
            | KeyType::ChannelEventsByLastUpdated
            | KeyType::DirectChatUserMetrics
            | KeyType::GroupChatUserMetrics
            | KeyType::ChannelUserMetrics
            | KeyType::DirectChatSearchToken
            | KeyType::GroupChatSearchToken
            | KeyType::ChannelSearchToken
            | KeyType::DirectChatSearchSender
            | KeyType::GroupChatSearchSender
            | KeyType::ChannelSearchSender
            | KeyType::MessageActivityEvent
            | KeyType::MessageActivityEventId
            | KeyType::ChitEvent
            | KeyType::GroupThreadRead
            | KeyType::ChannelThreadRead
            | KeyType::Referral
            | KeyType::StreakInsurancePayment
            | KeyType::StreakInsuranceClaim
            | KeyType::BlockedUser
            | KeyType::DirectChatUnreadMessageIndex
            | KeyType::DirectChatRemoved
            | KeyType::GroupChatRemoved
            | KeyType::CommunityRemoved
            | KeyType::PrivateReplyToGroup => MapClass::SmallEntries,
            #[cfg(test)]
            KeyType::TestSmallEntries => MapClass::SmallEntries,
        }
    }

    #[cfg(test)]
    pub(crate) fn all() -> impl Iterator<Item = KeyType> {
        (0..=u8::MAX).filter_map(|b| KeyType::try_from(b).ok())
    }
}

// Keys whose first byte isn't a known key type are routed to the main map
pub(crate) fn map_class(key_bytes: &[u8]) -> MapClass {
    extract_key_type(key_bytes).map_or(MapClass::Default, KeyType::map_class)
}

pub(crate) fn extract_key_type(bytes: &[u8]) -> Option<KeyType> {
    bytes.first().and_then(|b| KeyType::try_from(*b).ok())
}

impl TryFrom<u8> for KeyType {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(KeyType::DirectChatEventLegacy),
            2 => Ok(KeyType::GroupChatEvent),
            3 => Ok(KeyType::ChannelEvent),
            4 => Ok(KeyType::DirectChatThreadEventLegacy),
            5 => Ok(KeyType::GroupChatThreadEvent),
            6 => Ok(KeyType::ChannelThreadEvent),
            7 => Ok(KeyType::GroupMember),
            8 => Ok(KeyType::ChannelMember),
            9 => Ok(KeyType::CommunityMember),
            10 => Ok(KeyType::CommunityEvent),
            11 => Ok(KeyType::PrincipalToUserId),
            12 => Ok(KeyType::FileIdToFile),
            13 => Ok(KeyType::FileReferenceCount),
            14 => Ok(KeyType::FilesPerAccessor),
            15 => Ok(KeyType::UserStorageRecord),
            16 => Ok(KeyType::BlockedUsers),
            17 => Ok(KeyType::DirectChatMessageId),
            18 => Ok(KeyType::GroupChatMessageId),
            19 => Ok(KeyType::ChannelMessageId),
            20 => Ok(KeyType::DirectChatThreadMessageId),
            21 => Ok(KeyType::GroupChatThreadMessageId),
            22 => Ok(KeyType::ChannelThreadMessageId),
            23 => Ok(KeyType::DirectChatExpiringEvent),
            24 => Ok(KeyType::GroupChatExpiringEvent),
            25 => Ok(KeyType::ChannelExpiringEvent),
            26 => Ok(KeyType::DirectChatEventLastUpdated),
            27 => Ok(KeyType::GroupChatEventLastUpdated),
            28 => Ok(KeyType::ChannelEventLastUpdated),
            29 => Ok(KeyType::DirectChatEventsByLastUpdated),
            30 => Ok(KeyType::GroupChatEventsByLastUpdated),
            31 => Ok(KeyType::ChannelEventsByLastUpdated),
            32 => Ok(KeyType::DirectChatUserMetrics),
            33 => Ok(KeyType::GroupChatUserMetrics),
            34 => Ok(KeyType::ChannelUserMetrics),
            35 => Ok(KeyType::DirectChatMessageEventIndexes),
            36 => Ok(KeyType::GroupChatMessageEventIndexes),
            37 => Ok(KeyType::ChannelMessageEventIndexes),
            38 => Ok(KeyType::DirectChatThreadMessageEventIndexes),
            39 => Ok(KeyType::GroupChatThreadMessageEventIndexes),
            40 => Ok(KeyType::ChannelThreadMessageEventIndexes),
            41 => Ok(KeyType::DirectChatSearchToken),
            42 => Ok(KeyType::GroupChatSearchToken),
            43 => Ok(KeyType::ChannelSearchToken),
            44 => Ok(KeyType::DirectChatSearchSender),
            45 => Ok(KeyType::GroupChatSearchSender),
            46 => Ok(KeyType::ChannelSearchSender),
            47 => Ok(KeyType::MessageActivityEvent),
            48 => Ok(KeyType::MessageActivityEventId),
            49 => Ok(KeyType::ChitEvent),
            50 => Ok(KeyType::GroupThreadRead),
            51 => Ok(KeyType::ChannelThreadRead),
            52 => Ok(KeyType::TokenSwap),
            53 => Ok(KeyType::P2PSwap),
            54 => Ok(KeyType::Referral),
            55 => Ok(KeyType::StreakInsurancePayment),
            56 => Ok(KeyType::StreakInsuranceClaim),
            57 => Ok(KeyType::DirectChatEvent),
            58 => Ok(KeyType::DirectChatThreadEvent),
            59 => Ok(KeyType::Contact),
            60 => Ok(KeyType::BlockedUser),
            61 => Ok(KeyType::DirectChatUnreadMessageIndex),
            62 => Ok(KeyType::DirectChatRemoved),
            63 => Ok(KeyType::GroupChatRemoved),
            64 => Ok(KeyType::CommunityRemoved),
            65 => Ok(KeyType::ProfileDocument),
            66 => Ok(KeyType::PrivateReplyToGroup),
            #[cfg(test)]
            255 => Ok(KeyType::TestSmallEntries),
            _ => Err(()),
        }
    }
}

#[cfg(test)]
pub(crate) mod test_small_entries {
    use crate::keys::macros::key;
    use crate::{KeyPrefix, KeyType};

    key!(TestSmallEntriesKey, TestSmallEntriesKeyPrefix, KeyType::TestSmallEntries);

    impl TestSmallEntriesKeyPrefix {
        pub fn new() -> Self {
            TestSmallEntriesKeyPrefix(vec![KeyType::TestSmallEntries as u8])
        }
    }

    impl KeyPrefix for TestSmallEntriesKeyPrefix {
        type Key = TestSmallEntriesKey;
        type Suffix = u32;

        fn create_key(&self, value: &u32) -> Self::Key {
            let mut bytes = self.0.clone();
            bytes.extend_from_slice(&value.to_be_bytes());
            TestSmallEntriesKey(bytes)
        }
    }
}
