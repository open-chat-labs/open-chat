use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::{ChannelId, Chat, EventIndex, MessageIndex, UserId};

key!(
    ChatEventKey,
    ChatEventKeyPrefix,
    KeyType::DirectChatEvent
        | KeyType::GroupChatEvent
        | KeyType::ChannelEvent
        | KeyType::DirectChatThreadEvent
        | KeyType::GroupChatThreadEvent
        | KeyType::ChannelThreadEvent
        | KeyType::DirectChatEventV2
        | KeyType::DirectChatThreadEventV2
);

impl ChatEventKeyPrefix {
    pub fn new_from_chat(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        match chat {
            Chat::Direct(user_id) => Self::new_from_direct_chat(Principal::from(user_id).into(), thread_root_message_index),
            Chat::Group(_) => Self::new_from_group_chat(thread_root_message_index),
            Chat::Channel(_, channel_id) => Self::new_from_channel(channel_id, thread_root_message_index),
        }
    }

    pub fn new_from_direct_chat(user_id: UserId, thread_root_message_index: Option<MessageIndex>) -> Self {
        // Legacy layout, used by direct chats created before `key_id`s were introduced (see
        // `new_from_direct_chat_key_id`). We don't actually need the userId length marker but
        // existing entries have it so we need to keep it to be backwards compatible.

        let user_id_bytes = user_id.as_slice();

        match thread_root_message_index {
            None => {
                // KeyType::DirectChatEvent         1 byte
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

    pub fn new_from_direct_chat_key_id(key_id: u32, thread_root_message_index: Option<MessageIndex>) -> Self {
        // Each direct chat is assigned a unique `key_id` when it is created, which is used in place
        // of the other user's id. This keeps keys short and means that if a chat is deleted then
        // recreated with the same user, the new chat's keys never collide with the old ones. These
        // keys use their own key types so that they can never be confused with the legacy layout.
        match thread_root_message_index {
            None => {
                // KeyType::DirectChatEventV2       1 byte
                // KeyId                            4 bytes
                let mut bytes = Vec::with_capacity(5);
                bytes.push(KeyType::DirectChatEventV2 as u8);
                bytes.extend_from_slice(&key_id.to_be_bytes());
                ChatEventKeyPrefix(bytes)
            }
            Some(root_message_index) => {
                // KeyType::DirectChatThreadEventV2 1 byte
                // KeyId                            4 bytes
                // Thread root message index        4 bytes
                let mut bytes = Vec::with_capacity(9);
                bytes.push(KeyType::DirectChatThreadEventV2 as u8);
                bytes.extend_from_slice(&key_id.to_be_bytes());
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

    // Builds the prefix for a thread within the chat whose main events list has this prefix
    pub fn for_thread(&self, root_message_index: MessageIndex) -> Self {
        let key_type = thread_key_type(self.key_type()).expect("prefix is already for a thread");
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.push(key_type as u8);
        bytes.extend_from_slice(&self.0[1..]);
        bytes.extend_from_slice(&u32::from(root_message_index).to_be_bytes());
        ChatEventKeyPrefix(bytes)
    }

    pub fn is_direct_chat(&self) -> bool {
        matches!(
            self.key_type(),
            KeyType::DirectChatEvent
                | KeyType::DirectChatThreadEvent
                | KeyType::DirectChatEventV2
                | KeyType::DirectChatThreadEventV2
        )
    }

    pub fn is_thread(&self) -> bool {
        matches!(
            self.key_type(),
            KeyType::DirectChatThreadEvent
                | KeyType::GroupChatThreadEvent
                | KeyType::ChannelThreadEvent
                | KeyType::DirectChatThreadEventV2
        )
    }

    fn key_type(&self) -> KeyType {
        extract_key_type(&self.0).unwrap()
    }
}

impl KeyPrefix for ChatEventKeyPrefix {
    type Key = ChatEventKey;
    type Suffix = EventIndex;

    fn create_key(&self, event_index: &EventIndex) -> ChatEventKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(*event_index).to_be_bytes());
        ChatEventKey(bytes)
    }
}

// The key type of the threads of a chat whose main events list uses the given key type
fn thread_key_type(main_events_key_type: KeyType) -> Option<KeyType> {
    match main_events_key_type {
        KeyType::DirectChatEvent => Some(KeyType::DirectChatThreadEvent),
        KeyType::GroupChatEvent => Some(KeyType::GroupChatThreadEvent),
        KeyType::ChannelEvent => Some(KeyType::ChannelThreadEvent),
        KeyType::DirectChatEventV2 => Some(KeyType::DirectChatThreadEventV2),
        _ => None,
    }
}

impl ChatEventKey {
    // Whether the key belongs to the chat whose main events list has the given prefix, either in
    // the main events list or in one of its threads
    pub fn is_in_chat(&self, main_events_prefix: &ChatEventKeyPrefix) -> bool {
        let prefix_bytes = main_events_prefix.0.as_slice();
        if self.0.len() < prefix_bytes.len() || self.0[1..prefix_bytes.len()] != prefix_bytes[1..] {
            return false;
        }
        let main_key_type = main_events_prefix.key_type();
        let key_type = self.key_type();
        key_type == main_key_type || Some(key_type) == thread_key_type(main_key_type)
    }

    pub fn thread_root_message_index(&self) -> Option<MessageIndex> {
        if matches!(
            self.key_type(),
            KeyType::DirectChatThreadEvent
                | KeyType::GroupChatThreadEvent
                | KeyType::ChannelThreadEvent
                | KeyType::DirectChatThreadEventV2
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key};
    use rand::{Rng, RngExt, rng};
    use types::{ChannelId, Chat, EventIndex, MessageIndex};

    #[test]
    fn direct_chat_event_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let user_id_bytes: [u8; 10] = rng().random();
                let user_id = Principal::from_slice(&user_id_bytes);
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_direct_chat(user_id.into(), thread_root_message_index);
                let event_index = EventIndex::from(rng().next_u32());
                let key = BaseKey::from(prefix.create_key(&event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::DirectChatThreadEvent } else { KeyType::DirectChatEvent } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 20 } else { 16 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.is_in_chat(&ChatEventKeyPrefix::new_from_direct_chat(user_id.into(), None)));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_direct_chat(Principal::anonymous().into(), None)));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_direct_chat_key_id(1, None)));
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
    fn direct_chat_key_id_event_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let key_id = rng().next_u32();
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id, thread_root_message_index);
                let event_index = EventIndex::from(rng().next_u32());
                let key = BaseKey::from(prefix.create_key(&event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::DirectChatThreadEventV2 } else { KeyType::DirectChatEventV2 } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 13 } else { 9 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.is_in_chat(&ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id, None)));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id.wrapping_add(1), None)));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_direct_chat(Principal::anonymous().into(), None)));
                assert_eq!(event_key.event_index(), event_index);
                assert_eq!(event_key.thread_root_message_index(), thread_root_message_index);
                assert!(prefix.is_direct_chat());
                assert_eq!(prefix.is_thread(), thread);

                let serialized = msgpack::serialize_then_unwrap(&event_key);
                assert_eq!(serialized.len(), event_key.0.len() + 2);
                let deserialized: ChatEventKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, event_key);
                assert_eq!(deserialized.0, key.0);
            }
        }
    }

    #[test]
    fn for_thread_matches_new_from_chat() {
        let user_id_bytes: [u8; 10] = rng().random();
        let user_id = Principal::from_slice(&user_id_bytes).into();
        let channel_id = ChannelId::from(rng().next_u32());
        let root = MessageIndex::from(rng().next_u32());

        for chat in [
            Chat::Direct(user_id),
            Chat::Group(Principal::anonymous().into()),
            Chat::Channel(Principal::anonymous().into(), channel_id),
        ] {
            let main = ChatEventKeyPrefix::new_from_chat(chat, None);
            assert!(!main.is_thread());
            let thread = main.for_thread(root);
            assert!(thread.is_thread());
            assert_eq!(thread, ChatEventKeyPrefix::new_from_chat(chat, Some(root)));
            assert_eq!(main.is_direct_chat(), matches!(chat, Chat::Direct(_)));
        }

        let key_id = rng().next_u32();
        let main = ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id, None);
        assert_eq!(
            main.for_thread(root),
            ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id, Some(root))
        );
    }

    #[test]
    fn group_chat_event_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_group_chat(thread_root_message_index);
                let event_index = EventIndex::from(rng().next_u32());
                let key = BaseKey::from(prefix.create_key(&event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::GroupChatThreadEvent } else { KeyType::GroupChatEvent } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 9 } else { 5 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.is_in_chat(&ChatEventKeyPrefix::new_from_group_chat(None)));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_channel(1u32.into(), None)));
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
                let channel_id = ChannelId::from(rng().next_u32());
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let prefix = ChatEventKeyPrefix::new_from_channel(channel_id, thread_root_message_index);
                let event_index = EventIndex::from(rng().next_u32());
                let key = BaseKey::from(prefix.create_key(&event_index));
                let event_key = ChatEventKey::try_from(key.clone()).unwrap();

                assert_eq!(
                    *event_key.0.first().unwrap(),
                    if thread { KeyType::ChannelThreadEvent } else { KeyType::ChannelEvent } as u8
                );
                assert_eq!(event_key.0.len(), if thread { 13 } else { 9 });
                assert!(event_key.matches_prefix(&prefix));
                assert!(event_key.is_in_chat(&ChatEventKeyPrefix::new_from_channel(channel_id, None)));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_channel(
                    ChannelId::from(channel_id.as_u32().wrapping_add(1)),
                    None
                )));
                assert!(!event_key.is_in_chat(&ChatEventKeyPrefix::new_from_group_chat(None)));
                assert_eq!(event_key.event_index(), event_index);

                let serialized = msgpack::serialize_then_unwrap(&event_key);
                assert_eq!(serialized.len(), event_key.0.len() + 2);
                let deserialized: ChatEventKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, event_key);
                assert_eq!(deserialized.0, key.0);
            }
        }
    }
}
