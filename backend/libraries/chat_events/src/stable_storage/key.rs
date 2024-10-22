use candid::Principal;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::borrow::Cow;
use types::{CanisterId, ChannelId, Chat, EventIndex, MessageIndex, UserId};

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct Key {
    prefix: KeyPrefix,
    event_index: EventIndex,
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub enum KeyPrefix {
    DirectChat(DirectChatKeyPrefix),
    GroupChat(GroupChatKeyPrefix),
    Channel(ChannelKeyPrefix),
    DirectChatThread(DirectChatThreadKeyPrefix),
    GroupChatThread(GroupChatThreadKeyPrefix),
    ChannelThread(ChannelThreadKeyPrefix),
}

#[derive(Copy, Clone)]
#[repr(u8)]
enum KeyType {
    DirectChat = 1,
    GroupChat = 2,
    Channel = 3,
    DirectChatThread = 4,
    GroupChatThread = 5,
    ChannelThread = 6,
}

impl From<u8> for KeyType {
    fn from(value: u8) -> Self {
        match value {
            1 => KeyType::DirectChat,
            2 => KeyType::GroupChat,
            3 => KeyType::Channel,
            4 => KeyType::DirectChatThread,
            5 => KeyType::GroupChatThread,
            6 => KeyType::ChannelThread,
            _ => unreachable!(),
        }
    }
}

impl Key {
    pub fn new(prefix: KeyPrefix, event_index: EventIndex) -> Key {
        Key { prefix, event_index }
    }

    pub fn prefix(&self) -> &KeyPrefix {
        &self.prefix
    }

    pub fn event_index(&self) -> EventIndex {
        self.event_index
    }

    pub fn thread_root_message_index(&self) -> Option<MessageIndex> {
        self.prefix.thread_root_message_index()
    }

    pub fn matches_chat(&self, chat: Chat) -> bool {
        self.prefix.matches_chat(chat)
    }
}

impl KeyPrefix {
    pub fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> KeyPrefix {
        match (chat, thread_root_message_index) {
            (Chat::Direct(c), None) => KeyPrefix::DirectChat(DirectChatKeyPrefix::new(Principal::from(c).into())),
            (Chat::Direct(c), Some(m)) => {
                KeyPrefix::DirectChatThread(DirectChatThreadKeyPrefix::new(Principal::from(c).into(), m))
            }
            (Chat::Group(_), None) => KeyPrefix::GroupChat(GroupChatKeyPrefix::default()),
            (Chat::Group(_), Some(m)) => KeyPrefix::GroupChatThread(GroupChatThreadKeyPrefix::new(m)),
            (Chat::Channel(_, c), None) => KeyPrefix::Channel(ChannelKeyPrefix::new(c)),
            (Chat::Channel(_, c), Some(m)) => KeyPrefix::ChannelThread(ChannelThreadKeyPrefix::new(c, m)),
        }
    }

    pub fn matches_chat(&self, chat: Chat) -> bool {
        match self {
            KeyPrefix::DirectChat(k) => matches!(chat, Chat::Direct(c) if CanisterId::from(c) == k.user_id.0),
            KeyPrefix::GroupChat(_) => matches!(chat, Chat::Group(_)),
            KeyPrefix::Channel(k) => matches!(chat, Chat::Channel(_, c) if c == u128::from(k.channel_id)),
            KeyPrefix::DirectChatThread(k) => matches!(chat, Chat::Direct(c) if CanisterId::from(c) == k.user_id.0),
            KeyPrefix::GroupChatThread(_) => matches!(chat, Chat::Group(_)),
            KeyPrefix::ChannelThread(k) => matches!(chat, Chat::Channel(_, c) if c == u128::from(k.channel_id)),
        }
    }

    pub fn thread_root_message_index(&self) -> Option<MessageIndex> {
        match self {
            KeyPrefix::DirectChat(_) | KeyPrefix::GroupChat(_) | KeyPrefix::Channel(_) => None,
            KeyPrefix::DirectChatThread(k) => Some(k.thread_root_message_index.into()),
            KeyPrefix::GroupChatThread(k) => Some(k.thread_root_message_index.into()),
            KeyPrefix::ChannelThread(k) => Some(k.thread_root_message_index.into()),
        }
    }

    fn key_type(&self) -> KeyType {
        match self {
            KeyPrefix::DirectChat(_) => KeyType::DirectChat,
            KeyPrefix::GroupChat(_) => KeyType::GroupChat,
            KeyPrefix::Channel(_) => KeyType::Channel,
            KeyPrefix::DirectChatThread(_) => KeyType::DirectChatThread,
            KeyPrefix::GroupChatThread(_) => KeyType::GroupChatThread,
            KeyPrefix::ChannelThread(_) => KeyType::ChannelThread,
        }
    }
}

impl Storable for Key {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = self.prefix.to_bytes().to_vec();
        bytes.extend_from_slice(&u32::from(self.event_index).to_be_bytes());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let len = bytes.len();
        let prefix = KeyPrefix::from_bytes(Cow::Borrowed(&bytes[..len - 4]));
        let event_index = u32::from_be_bytes(bytes[(len - 4)..].try_into().unwrap()).into();
        Key { prefix, event_index }
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for KeyPrefix {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::new();
        bytes.push(self.key_type() as u8);

        bytes.extend_from_slice(
            match self {
                KeyPrefix::DirectChat(k) => k.to_bytes(),
                KeyPrefix::GroupChat(k) => k.to_bytes(),
                KeyPrefix::Channel(k) => k.to_bytes(),
                KeyPrefix::DirectChatThread(k) => k.to_bytes(),
                KeyPrefix::GroupChatThread(k) => k.to_bytes(),
                KeyPrefix::ChannelThread(k) => k.to_bytes(),
            }
            .as_ref(),
        );

        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let key_type = KeyType::from(bytes[0]);
        let bytes = Cow::Borrowed(&bytes.as_ref()[1..]);

        match key_type {
            KeyType::DirectChat => KeyPrefix::DirectChat(DirectChatKeyPrefix::from_bytes(bytes)),
            KeyType::GroupChat => KeyPrefix::GroupChat(GroupChatKeyPrefix::from_bytes(bytes)),
            KeyType::Channel => KeyPrefix::Channel(ChannelKeyPrefix::from_bytes(bytes)),
            KeyType::DirectChatThread => KeyPrefix::DirectChatThread(DirectChatThreadKeyPrefix::from_bytes(bytes)),
            KeyType::GroupChatThread => KeyPrefix::GroupChatThread(GroupChatThreadKeyPrefix::from_bytes(bytes)),
            KeyType::ChannelThread => KeyPrefix::ChannelThread(ChannelThreadKeyPrefix::from_bytes(bytes)),
        }
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct DirectChatKeyPrefix {
    user_id: CanisterIdWithSize,
}

impl DirectChatKeyPrefix {
    pub fn new(user_id: UserId) -> Self {
        Self {
            user_id: CanisterIdWithSize(user_id.into()),
        }
    }
}

#[derive(Clone, Default, Eq, PartialEq, Ord, PartialOrd)]
pub struct GroupChatKeyPrefix {}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct ChannelKeyPrefix {
    channel_id: u32,
}

impl ChannelKeyPrefix {
    pub fn new(channel_id: ChannelId) -> Self {
        ChannelKeyPrefix {
            channel_id: channel_id as u32,
        }
    }
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct DirectChatThreadKeyPrefix {
    user_id: CanisterIdWithSize,
    thread_root_message_index: u32,
}

impl DirectChatThreadKeyPrefix {
    pub fn new(user_id: UserId, thread_root_message_index: MessageIndex) -> Self {
        Self {
            user_id: CanisterIdWithSize(user_id.into()),
            thread_root_message_index: thread_root_message_index.into(),
        }
    }
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct GroupChatThreadKeyPrefix {
    thread_root_message_index: u32,
}

impl GroupChatThreadKeyPrefix {
    pub fn new(thread_root_message_index: MessageIndex) -> Self {
        Self {
            thread_root_message_index: thread_root_message_index.into(),
        }
    }
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct ChannelThreadKeyPrefix {
    channel_id: u32,
    thread_root_message_index: u32,
}

impl ChannelThreadKeyPrefix {
    pub fn new(channel_id: ChannelId, thread_root_message_index: MessageIndex) -> Self {
        ChannelThreadKeyPrefix {
            channel_id: channel_id as u32,
            thread_root_message_index: thread_root_message_index.into(),
        }
    }
}

fn read_value<T: Storable + SizeFromReader>(bytes: &mut &[u8]) -> T {
    let size = T::size(bytes[0]);
    let value = T::from_bytes(Cow::Borrowed(&bytes[..size]));
    *bytes = &bytes[size..];
    value
}

trait SizeFromReader {
    fn size(next_byte: u8) -> usize;
}

impl SizeFromReader for CanisterIdWithSize {
    fn size(next_byte: u8) -> usize {
        next_byte as usize + 1
    }
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
struct CanisterIdWithSize(CanisterId);

impl Storable for CanisterIdWithSize {
    fn to_bytes(&self) -> Cow<[u8]> {
        let canister_id_len = self.0.as_ref().len();
        let mut bytes = Vec::with_capacity(canister_id_len + 1);
        bytes.push(canister_id_len as u8);
        bytes.extend_from_slice(self.0.as_ref());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        CanisterIdWithSize(CanisterId::from_slice(&bytes[1..]))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: CanisterId::BOUND.max_size() + 1,
        is_fixed_size: false,
    };
}
macro_rules! storable_as_tuple {
    ($ty:ident) => {
        impl Storable for $ty {
            fn to_bytes(&self) -> Cow<[u8]> {
                Cow::Owned(Vec::new())
            }

            fn from_bytes(_bytes: Cow<[u8]>) -> Self {
                Self {}
            }

            const BOUND: Bound = Bound::Bounded { is_fixed_size: true, max_size: 0 };
        }
    };
    ($ty:ident, $($field:ident),+) => {
        impl Storable for $ty {
            fn to_bytes(&self) -> Cow<[u8]> {
                let mut bytes = Vec::new();
                $(
                    bytes.extend_from_slice(self.$field.to_bytes().as_ref());
                )*
                Cow::Owned(bytes)
            }

            fn from_bytes(bytes: Cow<[u8]>) -> Self {
                let mut slice = bytes.as_ref();

                Self {
                    $(
                        $field: read_value(&mut slice),
                    )*
                }
            }

            const BOUND: Bound = Bound::Unbounded;
        }
    };
}

storable_as_tuple!(DirectChatKeyPrefix, user_id);
storable_as_tuple!(GroupChatKeyPrefix);
storable_as_tuple!(ChannelKeyPrefix, channel_id);
storable_as_tuple!(DirectChatThreadKeyPrefix, user_id, thread_root_message_index);
storable_as_tuple!(GroupChatThreadKeyPrefix, thread_root_message_index);
storable_as_tuple!(ChannelThreadKeyPrefix, channel_id, thread_root_message_index);

macro_rules! size_from_reader_fixed {
    ($ty:ident) => {
        impl SizeFromReader for $ty {
            fn size(_: u8) -> usize {
                size_of::<$ty>()
            }
        }
    };
}

size_from_reader_fixed!(u32);

impl Serialize for KeyPrefix {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let bytes = self.to_bytes();
        serializer.serialize_bytes(&bytes)
    }
}

impl<'de> Deserialize<'de> for KeyPrefix {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = Vec::deserialize(deserializer)?;
        Ok(KeyPrefix::from_bytes(Cow::Owned(bytes)))
    }
}
