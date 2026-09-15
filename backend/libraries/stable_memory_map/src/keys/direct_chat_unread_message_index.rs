use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use types::{MessageIndex, UserId};

// For each message the other user has sent in a direct chat which hasn't yet been read, the index
// of the message in their copy of the chat, keyed by its index in ours.
//
// Each user canister currently holds a single user, so the prefix identifies only the chat.
key!(
    DirectChatUnreadMessageIndexKey,
    DirectChatUnreadMessageIndexKeyPrefix,
    KeyType::DirectChatUnreadMessageIndex
);

impl DirectChatUnreadMessageIndexKeyPrefix {
    pub fn new(them: UserId) -> Self {
        // KeyType::DirectChatUnreadMessageIndex    1 byte
        // UserId length                            1 byte
        // UserId bytes                             UserId length bytes
        let user_id_bytes = them.as_slice();
        let mut bytes = Vec::with_capacity(user_id_bytes.len() + 2);
        bytes.push(KeyType::DirectChatUnreadMessageIndex as u8);
        bytes.push(user_id_bytes.len() as u8);
        bytes.extend_from_slice(user_id_bytes);
        DirectChatUnreadMessageIndexKeyPrefix(bytes)
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
    use rand::{Rng, RngExt, rng};

    #[test]
    fn direct_chat_unread_message_index_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = rng().random();
            let them = UserId::from(Principal::from_slice(&user_id_bytes));
            let our_message_index = MessageIndex::from(rng().next_u32());

            let prefix = DirectChatUnreadMessageIndexKeyPrefix::new(them);
            let key = prefix.create_key(&our_message_index);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::DirectChatUnreadMessageIndex as u8);
            assert_eq!(key_bytes.len(), 16);
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
        let prefix = DirectChatUnreadMessageIndexKeyPrefix::new(Principal::from_slice(&[1; 10]).into());
        assert!(prefix.create_key(&255.into()) < prefix.create_key(&256.into()));
        let other = DirectChatUnreadMessageIndexKeyPrefix::new(Principal::from_slice(&[2; 10]).into());
        assert!(!prefix.create_key(&1.into()).matches_prefix(&other));
    }
}
