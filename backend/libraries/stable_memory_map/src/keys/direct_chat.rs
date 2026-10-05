use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};

// The user's direct chats, each serialized whole and keyed by the chat's `key_id`, which is unique
// to the chat (see `ChatEventKeyPrefix::new_from_direct_chat_key_id`).
//
// In a canister which holds many users the key is scoped to the user (see `key_scope`), so the
// prefix is just the key type.
key!(DirectChatKey, DirectChatKeyPrefix, KeyType::DirectChat);

impl DirectChatKeyPrefix {
    pub fn new() -> Self {
        // KeyType::DirectChat     1 byte
        DirectChatKeyPrefix(vec![KeyType::DirectChat as u8])
    }
}

impl Default for DirectChatKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for DirectChatKeyPrefix {
    type Key = DirectChatKey;
    type Suffix = u32;

    fn create_key(&self, key_id: &u32) -> DirectChatKey {
        // KeyId            4 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&key_id.to_be_bytes());
        DirectChatKey(bytes)
    }
}

impl DirectChatKey {
    pub fn key_id(&self) -> u32 {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{Rng, rng};

    #[test]
    fn direct_chat_key_e2e() {
        for _ in 0..100 {
            let key_id = rng().next_u32();

            let prefix = DirectChatKeyPrefix::new();
            let key = prefix.create_key(&key_id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::DirectChat as u8);
            assert_eq!(key_bytes.len(), 5);
            assert_eq!(KeyType::DirectChat.map_class(), MapClass::Default);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.key_id(), key_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: DirectChatKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn keys_are_ordered_by_key_id() {
        let prefix = DirectChatKeyPrefix::new();
        assert!(prefix.create_key(&255) < prefix.create_key(&256));
    }
}
