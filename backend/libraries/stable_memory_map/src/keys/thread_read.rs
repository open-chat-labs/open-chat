use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::{ChannelId, ChatId, CommunityId, MessageIndex, MultiUserChat};

// How far a user has read each thread in a group or channel, keyed by the thread's root message
// index.
//
// Each user canister currently holds a single user, so the prefixes identify only the chat.
key!(
    ThreadReadKey,
    ThreadReadKeyPrefix,
    KeyType::GroupThreadRead | KeyType::ChannelThreadRead
);

impl ThreadReadKeyPrefix {
    pub fn new_from_chat(chat: MultiUserChat) -> Self {
        match chat {
            MultiUserChat::Group(chat_id) => Self::new_from_group(chat_id),
            MultiUserChat::Channel(community_id, channel_id) => Self::new_from_channel(community_id, channel_id),
        }
    }

    pub fn new_from_group(chat_id: ChatId) -> Self {
        // KeyType::GroupThreadRead     1 byte
        // ChatId length                1 byte
        // ChatId bytes                 ChatId length bytes
        let chat_id_bytes = Principal::from(chat_id);
        let chat_id_bytes = chat_id_bytes.as_slice();
        let mut bytes = Vec::with_capacity(chat_id_bytes.len() + 2);
        bytes.push(KeyType::GroupThreadRead as u8);
        bytes.push(chat_id_bytes.len() as u8);
        bytes.extend_from_slice(chat_id_bytes);
        ThreadReadKeyPrefix(bytes)
    }

    pub fn new_from_channel(community_id: CommunityId, channel_id: ChannelId) -> Self {
        // KeyType::ChannelThreadRead   1 byte
        // CommunityId length           1 byte
        // CommunityId bytes            CommunityId length bytes
        // ChannelId                    4 bytes
        let community_id_bytes = Principal::from(community_id);
        let community_id_bytes = community_id_bytes.as_slice();
        let mut bytes = Vec::with_capacity(community_id_bytes.len() + 6);
        bytes.push(KeyType::ChannelThreadRead as u8);
        bytes.push(community_id_bytes.len() as u8);
        bytes.extend_from_slice(community_id_bytes);
        bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        ThreadReadKeyPrefix(bytes)
    }
}

impl KeyPrefix for ThreadReadKeyPrefix {
    type Key = ThreadReadKey;
    type Suffix = MessageIndex;

    fn create_key(&self, root_message_index: &MessageIndex) -> ThreadReadKey {
        // Thread root message index    4 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(*root_message_index).to_be_bytes());
        ThreadReadKey(bytes)
    }
}

impl ThreadReadKey {
    pub fn root_message_index(&self) -> MessageIndex {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap()).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{Rng, RngExt, rng};

    #[test]
    fn thread_read_key_e2e() {
        for _ in 0..100 {
            let canister_id_bytes: [u8; 10] = rng().random();
            let canister_id = Principal::from_slice(&canister_id_bytes);
            let channel_id = ChannelId::from(rng().next_u32());
            let root_message_index = MessageIndex::from(rng().next_u32());

            let (chat, key_type, prefix_len) = if rng().random_bool(0.5) {
                (MultiUserChat::Group(canister_id.into()), KeyType::GroupThreadRead, 12)
            } else {
                (
                    MultiUserChat::Channel(canister_id.into(), channel_id),
                    KeyType::ChannelThreadRead,
                    16,
                )
            };

            let prefix = ThreadReadKeyPrefix::new_from_chat(chat);
            let key = prefix.create_key(&root_message_index);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], key_type as u8);
            assert_eq!(key_bytes.len(), prefix_len + 4);
            assert_eq!(key_type.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.root_message_index(), root_message_index);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: ThreadReadKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }
}
