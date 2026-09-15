use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use types::MessageIndex;

// For each message the other user has sent in a direct chat which hasn't yet been read, the index
// of the message in their copy of the chat, keyed by its index in ours.
//
// The prefixes have the same layout as the `ChatEventKeyPrefix` of the chat's main events list,
// with only the key type differing, so they contain the chat's `key_id`.
key!(
    DirectChatUnreadMessageIndexKey,
    DirectChatUnreadMessageIndexKeyPrefix,
    KeyType::DirectChatUnreadMessageIndex
);

impl DirectChatUnreadMessageIndexKeyPrefix {
    pub fn new_from_direct_chat_key_id(key_id: u32) -> Self {
        Self::new_from_events_prefix(&ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id, None))
    }

    // Panics if the events prefix isn't for the main events list of a `key_id` based direct chat
    pub fn new_from_events_prefix(events_prefix: &ChatEventKeyPrefix) -> Self {
        Self::try_from(events_prefix).unwrap()
    }
}

// Fails unless the events prefix is for the main events list of a `key_id` based direct chat
impl TryFrom<&ChatEventKeyPrefix> for DirectChatUnreadMessageIndexKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        if extract_key_type(&bytes) != Some(KeyType::DirectChatEvent) {
            return Err(());
        }
        bytes[0] = KeyType::DirectChatUnreadMessageIndex as u8;
        Ok(DirectChatUnreadMessageIndexKeyPrefix(bytes))
    }
}

impl KeyPrefix for DirectChatUnreadMessageIndexKeyPrefix {
    type Key = DirectChatUnreadMessageIndexKey;
    type Suffix = MessageIndex;

    fn create_key(&self, our_message_index: &MessageIndex) -> DirectChatUnreadMessageIndexKey {
        // Our message index    4 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(*our_message_index).to_be_bytes());
        DirectChatUnreadMessageIndexKey(bytes)
    }
}

impl DirectChatUnreadMessageIndexKey {
    pub fn our_message_index(&self) -> MessageIndex {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap()).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use ic_principal::Principal;
    use rand::{Rng, rng};
    use types::{ChannelId, UserId};

    #[test]
    fn direct_chat_unread_message_index_key_e2e() {
        for _ in 0..100 {
            let key_id = rng().next_u32();
            let our_message_index = MessageIndex::from(rng().next_u32());

            let prefix = DirectChatUnreadMessageIndexKeyPrefix::new_from_direct_chat_key_id(key_id);
            let key = prefix.create_key(&our_message_index);
            let key_bytes = key.0.clone();

            // KeyType, KeyId, our message index
            assert_eq!(key_bytes[0], KeyType::DirectChatUnreadMessageIndex as u8);
            assert_eq!(key_bytes[1..5], key_id.to_be_bytes());
            assert_eq!(key_bytes.len(), 9);
            assert_eq!(KeyType::DirectChatUnreadMessageIndex.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.our_message_index(), our_message_index);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: DirectChatUnreadMessageIndexKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn keys_are_ordered_by_our_message_index() {
        let prefix = DirectChatUnreadMessageIndexKeyPrefix::new_from_direct_chat_key_id(1);
        assert!(prefix.create_key(&255.into()) < prefix.create_key(&256.into()));
        let other = DirectChatUnreadMessageIndexKeyPrefix::new_from_direct_chat_key_id(2);
        assert!(!prefix.create_key(&1.into()).matches_prefix(&other));
    }

    #[test]
    fn only_key_id_based_direct_chat_prefixes_are_accepted() {
        let user_id = UserId::from(Principal::from_slice(&[1; 10]));
        let invalid = [
            ChatEventKeyPrefix::new_from_direct_chat_key_id(1, Some(1.into())),
            ChatEventKeyPrefix::new_from_direct_chat_legacy(user_id, None),
            ChatEventKeyPrefix::new_from_group_chat(None),
            ChatEventKeyPrefix::new_from_channel(ChannelId::from(1u32), None),
        ];
        for events_prefix in invalid {
            assert!(DirectChatUnreadMessageIndexKeyPrefix::try_from(&events_prefix).is_err());
        }
    }
}
