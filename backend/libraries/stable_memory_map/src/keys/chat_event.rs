use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKey, KeyPrefix, KeyType};
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Key;
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
                let key = BaseKey::from(prefix.create_key(&event_index));
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
                let key = BaseKey::from(prefix.create_key(&event_index));
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
                let key = BaseKey::from(prefix.create_key(&event_index));
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
}
