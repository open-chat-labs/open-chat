use ic_principal::Principal;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use types::{ChannelId, Chat, EventIndex, MessageIndex, MultiUserChat, UserId};

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[serde(transparent)]
pub struct Key(#[serde(with = "serde_bytes")] Vec<u8>);

impl Key {
    pub fn starts_with(&self, prefix: &[u8]) -> bool {
        self.0.starts_with(prefix)
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }
}

impl Storable for Key {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Key(bytes.to_vec())
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl From<KeyPrefix> for Key {
    fn from(value: KeyPrefix) -> Self {
        Key(value.0)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[serde(transparent)]
pub struct KeyPrefix(#[serde(with = "serde_bytes")] Vec<u8>);

impl KeyPrefix {
    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }
}

macro_rules! key {
    ($key_name:ident, $key_prefix_name:ident, $key_types:pat) => {
        #[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
        #[serde(into = "Key", try_from = "Key")]
        pub struct $key_name(Vec<u8>);

        #[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
        #[serde(into = "KeyPrefix", try_from = "KeyPrefix")]
        pub struct $key_prefix_name(Vec<u8>);

        impl From<$key_name> for Key {
            fn from(value: $key_name) -> Self {
                Key(value.0)
            }
        }

        impl From<$key_prefix_name> for KeyPrefix {
            fn from(value: $key_prefix_name) -> Self {
                KeyPrefix(value.0)
            }
        }

        impl TryFrom<Key> for $key_name {
            type Error = String;

            fn try_from(value: Key) -> Result<Self, Self::Error> {
                validate_key(&value.0, |kt| matches!(kt, $key_types)).map(|_| $key_name(value.0))
            }
        }

        impl TryFrom<KeyPrefix> for $key_prefix_name {
            type Error = String;

            fn try_from(value: KeyPrefix) -> Result<Self, Self::Error> {
                validate_key(&value.0, |kt| matches!(kt, $key_types)).map(|_| $key_prefix_name(value.0))
            }
        }

        impl $key_name {
            pub fn matches_prefix(&self, prefix: &$key_prefix_name) -> bool {
                self.0.starts_with(&prefix.0)
            }
        }
    };
}

key!(
    ChatEventKey,
    ChatEventKeyPrefix,
    KeyType::DirectChatEvent
        | KeyType::GroupChatEvent
        | KeyType::ChannelEvent
        | KeyType::DirectChatThreadEvent
        | KeyType::GroupChatThreadEvent
        | KeyType::ChannelThreadEvent
);

key!(
    MemberKey,
    MemberKeyPrefix,
    KeyType::GroupMember | KeyType::ChannelMember | KeyType::CommunityMember
);

key!(CommunityEventKey, CommunityEventKeyPrefix, KeyType::CommunityEvent);

fn validate_key<F: FnOnce(KeyType) -> bool>(key: &[u8], validator: F) -> Result<(), String> {
    if extract_key_type(key).is_some_and(validator) {
        Ok(())
    } else {
        Err(format!("Key type mismatch: {:?}", key.first()))
    }
}

impl ChatEventKeyPrefix {
    pub fn new_from_chat(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        match chat {
            Chat::Direct(user_id) => Self::new_from_direct_chat(Principal::from(user_id).into(), thread_root_message_index),
            Chat::Group(_) => Self::new_from_group_chat(thread_root_message_index),
            Chat::Channel(_, channel_id) => Self::new_from_channel(channel_id, thread_root_message_index),
        }
    }

    pub fn new_from_direct_chat(user_id: UserId, thread_root_message_index: Option<MessageIndex>) -> Self {
        // We don't actually need the userId length marker but existing entries have it so we
        // need to keep it to be backwards compatible. If we decide we want to remove it then we
        // can switch to a new KeyType for direct chat events, but that is quite a lot of work
        // and complexity since we'd still have to support the old version too (or migrate them).

        let user_id_bytes = user_id.as_slice();

        match thread_root_message_index {
            None => {
                // KeyType::DirectChatThreadEvent   1 byte
                // UserId length                    1 byte
                // UserId bytes                     UserId length bytes
                let mut bytes = Vec::with_capacity(user_id_bytes.len() + 2);
                bytes.push(KeyType::DirectChatEvent as u8);
                bytes.push(user_id_bytes.len() as u8);
                bytes.extend_from_slice(user_id_bytes);
                ChatEventKeyPrefix(bytes)
            }
            Some(root_message_index) => {
                // KeyType::DirectChatThreadEvent   1 byte
                // UserId length                    1 byte
                // UserId bytes                     UserId length bytes
                // Thread root message index        4 bytes
                let mut bytes = Vec::with_capacity(user_id_bytes.len() + 6);
                bytes.push(KeyType::DirectChatThreadEvent as u8);
                bytes.push(user_id_bytes.len() as u8);
                bytes.extend_from_slice(user_id_bytes);
                bytes.extend_from_slice(&u32::from(root_message_index).to_be_bytes());
                ChatEventKeyPrefix(bytes)
            }
        }
    }

    pub fn new_from_group_chat(thread_root_message_index: Option<MessageIndex>) -> Self {
        match thread_root_message_index {
            None => {
                // KeyType::GroupChatEvent          1 byte
                ChatEventKeyPrefix(vec![KeyType::GroupChatEvent as u8])
            }
            Some(root_message_index) => {
                // KeyType::GroupChatThreadEvent    1 byte
                // Thread root message index        4 bytes
                let mut bytes = Vec::with_capacity(5);
                bytes.push(KeyType::GroupChatThreadEvent as u8);
                bytes.extend_from_slice(&u32::from(root_message_index).to_be_bytes());
                ChatEventKeyPrefix(bytes)
            }
        }
    }

    pub fn new_from_channel(channel_id: ChannelId, thread_root_message_index: Option<MessageIndex>) -> Self {
        match thread_root_message_index {
            None => {
                // KeyType::ChannelEvent        1 byte
                // ChannelId                    4 bytes
                let mut bytes = Vec::with_capacity(5);
                bytes.push(KeyType::ChannelEvent as u8);
                bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
                ChatEventKeyPrefix(bytes)
            }
            Some(root_message_index) => {
                // KeyType::ChannelThreadEvent  1 byte
                // ChannelId                    4 bytes
                // Thread root message index    4 bytes
                let mut bytes = Vec::with_capacity(9);
                bytes.push(KeyType::ChannelThreadEvent as u8);
                bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
                bytes.extend_from_slice(&u32::from(root_message_index).to_be_bytes());
                ChatEventKeyPrefix(bytes)
            }
        }
    }

    pub fn create_key(&self, event_index: EventIndex) -> ChatEventKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(event_index).to_be_bytes());
        ChatEventKey(bytes)
    }
}

impl ChatEventKey {
    pub fn matches_chat(&self, chat: &Chat) -> bool {
        match (chat, self.key_type()) {
            (Chat::Direct(id), KeyType::DirectChatEvent | KeyType::DirectChatThreadEvent) => {
                let user_id_len = self.0[1] as usize;
                let user_id_start = 2;
                let user_id_end = user_id_start + user_id_len;
                let user_id = Principal::from_slice(&self.0[user_id_start..user_id_end]).into();
                *id == user_id
            }
            (Chat::Group(_), KeyType::GroupChatEvent | KeyType::GroupChatThreadEvent) => true,
            (Chat::Channel(_, id), KeyType::ChannelEvent | KeyType::ChannelThreadEvent) => {
                let channel_id = u32::from_be_bytes(self.0[1..5].try_into().unwrap()).into();
                *id == channel_id
            }
            _ => false,
        }
    }

    pub fn thread_root_message_index(&self) -> Option<MessageIndex> {
        if matches!(
            self.key_type(),
            KeyType::DirectChatThreadEvent | KeyType::GroupChatThreadEvent | KeyType::ChannelThreadEvent
        ) {
            let start = self.0.len() - 8;
            let end = start + 4;
            Some(u32::from_be_bytes(self.0[start..end].try_into().unwrap()).into())
        } else {
            None
        }
    }

    pub fn event_index(&self) -> EventIndex {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap()).into()
    }

    fn key_type(&self) -> KeyType {
        extract_key_type(&self.0).unwrap()
    }
}

impl MemberKeyPrefix {
    pub fn new_from_chat(chat: MultiUserChat) -> Self {
        match chat {
            MultiUserChat::Group(_) => Self::new_from_group(),
            MultiUserChat::Channel(_, channel_id) => Self::new_from_channel(channel_id),
        }
    }

    pub fn new_from_group() -> Self {
        // KeyType::GroupMember     1 byte
        MemberKeyPrefix(vec![KeyType::GroupMember as u8])
    }

    pub fn new_from_channel(channel_id: ChannelId) -> Self {
        // KeyType::ChannelMember   1 byte
        // ChannelId                4 bytes
        let mut bytes = Vec::with_capacity(5);
        bytes.push(KeyType::ChannelMember as u8);
        bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        MemberKeyPrefix(bytes)
    }

    pub fn new_from_community() -> Self {
        // KeyType::CommunityMember     1 byte
        MemberKeyPrefix(vec![KeyType::CommunityMember as u8])
    }

    pub fn create_key(&self, user_id: UserId) -> MemberKey {
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + user_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(user_id_bytes);
        MemberKey(bytes)
    }
}

impl MemberKey {
    pub fn user_id(&self) -> UserId {
        let prefix_len = match self.key_type() {
            KeyType::GroupMember | KeyType::CommunityMember => 1,
            KeyType::ChannelMember => 5,
            _ => unreachable!(),
        };
        Principal::from_slice(&self.0[prefix_len..]).into()
    }

    fn key_type(&self) -> KeyType {
        KeyType::try_from(self.0[0]).unwrap()
    }
}

impl CommunityEventKeyPrefix {
    pub fn new() -> Self {
        // KeyType::CommunityEvent      1 byte
        CommunityEventKeyPrefix(vec![KeyType::CommunityEvent as u8])
    }

    pub fn create_key(&self, event_index: EventIndex) -> CommunityEventKey {
        let mut bytes = Vec::with_capacity(5);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(event_index).to_be_bytes());
        CommunityEventKey(bytes)
    }
}

impl Default for CommunityEventKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl CommunityEventKey {
    pub fn event_index(&self) -> EventIndex {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap()).into()
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
            _ => Err(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ChatEventKey, ChatEventKeyPrefix};
    use rand::{thread_rng, Rng, RngCore};
    use types::{ChannelId, Chat, EventIndex, MessageIndex};

    #[test]
    fn direct_chat_event_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let user_id_bytes: [u8; 10] = thread_rng().gen();
                let user_id = Principal::from_slice(&user_id_bytes);
                let thread_root_message_index = thread.then(|| MessageIndex::from(thread_rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_direct_chat(user_id.into(), thread_root_message_index);
                let event_index = EventIndex::from(thread_rng().next_u32());
                let key = Key::from(prefix.create_key(event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::DirectChatThreadEvent } else { KeyType::DirectChatEvent } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 20 } else { 16 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.matches_chat(&Chat::Direct(user_id.into())));
                assert_eq!(event_key.event_index(), event_index);

                let serialized = msgpack::serialize_then_unwrap(&event_key);
                assert_eq!(serialized.len(), event_key.0.len() + 2);
                let deserialized: ChatEventKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, event_key);
                assert_eq!(deserialized.0, key.0);
            }
        }
    }

    #[test]
    fn group_chat_event_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let thread_root_message_index = thread.then(|| MessageIndex::from(thread_rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_group_chat(thread_root_message_index);
                let event_index = EventIndex::from(thread_rng().next_u32());
                let key = Key::from(prefix.create_key(event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::GroupChatThreadEvent } else { KeyType::GroupChatEvent } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 9 } else { 5 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.matches_chat(&Chat::Group(Principal::anonymous().into())));
                assert_eq!(event_key.event_index(), event_index);
                assert_eq!(event_key.thread_root_message_index(), thread_root_message_index);

                let serialized = msgpack::serialize_then_unwrap(&event_key);
                assert_eq!(serialized.len(), event_key.0.len() + 2);
                let deserialized: ChatEventKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, event_key);
                assert_eq!(deserialized.0, key.0);
            }
        }
    }

    #[test]
    fn channel_event_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let channel_id = ChannelId::from(thread_rng().next_u32());
                let thread_root_message_index = thread.then(|| MessageIndex::from(thread_rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_channel(channel_id, thread_root_message_index);
                let event_index = EventIndex::from(thread_rng().next_u32());
                let key = Key::from(prefix.create_key(event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::ChannelThreadEvent } else { KeyType::ChannelEvent } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 13 } else { 9 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.matches_chat(&Chat::Channel(Principal::anonymous().into(), channel_id)));
                assert_eq!(event_key.event_index(), event_index);

                let serialized = msgpack::serialize_then_unwrap(&event_key);
                assert_eq!(serialized.len(), event_key.0.len() + 2);
                let deserialized: ChatEventKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, event_key);
                assert_eq!(deserialized.0, key.0);
            }
        }
    }

    #[test]
    fn group_chat_member_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = MemberKeyPrefix::new_from_group();
            let key = Key::from(prefix.create_key(user_id));
            let member_key = MemberKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::GroupMember as u8);
            assert_eq!(member_key.0.len(), 11);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: MemberKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn channel_member_key_e2e() {
        for _ in 0..100 {
            let channel_id = ChannelId::from(thread_rng().next_u32());
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = MemberKeyPrefix::new_from_channel(channel_id);
            let key = Key::from(prefix.create_key(user_id));
            let member_key = MemberKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::ChannelMember as u8);
            assert_eq!(member_key.0.len(), 15);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: MemberKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn community_member_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = MemberKeyPrefix::new_from_community();
            let key = Key::from(prefix.create_key(user_id));
            let member_key = MemberKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::CommunityMember as u8);
            assert_eq!(member_key.0.len(), 11);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: MemberKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn community_event_key_e2e() {
        for _ in 0..100 {
            let prefix = CommunityEventKeyPrefix::new();
            let event_index = EventIndex::from(thread_rng().next_u32());
            let key = Key::from(prefix.create_key(event_index));
            let event_key = CommunityEventKey::try_from(key.clone()).unwrap();

            assert_eq!(*event_key.0.first().unwrap(), KeyType::CommunityEvent as u8);
            assert_eq!(event_key.0.len(), 5);
            assert!(event_key.matches_prefix(&prefix));
            assert_eq!(event_key.event_index(), event_index);

            let serialized = msgpack::serialize_then_unwrap(&event_key);
            assert_eq!(serialized.len(), event_key.0.len() + 2);
            let deserialized: CommunityEventKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, event_key);
            assert_eq!(deserialized.0, key.0);
        }
    }
}
