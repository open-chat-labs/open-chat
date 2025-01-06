use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

mod chat_event;
mod community_event;
mod files;
mod macros;
mod member;
mod principal_to_user_id;

pub use chat_event::*;
pub use community_event::*;
pub use files::*;
pub use member::*;
pub use principal_to_user_id::*;

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[serde(transparent)]
pub struct BaseKey(#[serde(with = "serde_bytes")] Vec<u8>);

impl BaseKey {
    pub fn matches_prefix(&self, prefix: &BaseKeyPrefix) -> bool {
        self.0.starts_with(prefix.0.as_slice())
    }

    pub fn as_slice(&self) -> &[u8] {
        self.0.as_slice()
    }
}

impl Storable for BaseKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Borrowed(&self.0)
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

pub trait Key: Into<BaseKey> + TryFrom<BaseKey> + Clone {
    type Prefix: KeyPrefix;

    fn matches_prefix(&self, key: &Self::Prefix) -> bool;
}

pub trait KeyPrefix: Into<BaseKeyPrefix> + TryFrom<BaseKeyPrefix> + Clone {
    type Key;
    type Suffix;

    fn create_key(&self, value: &Self::Suffix) -> Self::Key;
}

fn validate_key<F: FnOnce(KeyType) -> bool>(key: &[u8], validator: F) -> Result<(), String> {
    if extract_key_type(key).is_some_and(validator) {
        Ok(())
    } else {
        Err(format!("Key type mismatch: {:?}", key.first()))
    }
}

#[derive(Copy, Clone, Eq, PartialEq)]
#[repr(u8)]
pub enum KeyType {
    DirectChatEvent = 1,
    GroupChatEvent = 2,
    ChannelEvent = 3,
    DirectChatThreadEvent = 4,
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
}

fn extract_key_type(bytes: &[u8]) -> Option<KeyType> {
    bytes.first().and_then(|b| KeyType::try_from(*b).ok())
}

impl TryFrom<u8> for KeyType {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(KeyType::DirectChatEvent),
            2 => Ok(KeyType::GroupChatEvent),
            3 => Ok(KeyType::ChannelEvent),
            4 => Ok(KeyType::DirectChatThreadEvent),
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
            _ => Err(()),
        }
    }
}
