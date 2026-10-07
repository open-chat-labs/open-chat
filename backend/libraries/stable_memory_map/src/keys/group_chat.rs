use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::ChatId;

// The user's records of the groups the user is in, each serialized whole and keyed by the group's id.
//
// In a canister which holds many users the key is scoped to the user (see `key_scope`), so the
// prefix is just the key type.
key!(GroupChatKey, GroupChatKeyPrefix, KeyType::GroupChat);

impl GroupChatKeyPrefix {
    pub fn new() -> Self {
        // KeyType::GroupChat     1 byte
        GroupChatKeyPrefix(vec![KeyType::GroupChat as u8])
    }
}

impl Default for GroupChatKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for GroupChatKeyPrefix {
    type Key = GroupChatKey;
    type Suffix = ChatId;

    fn create_key(&self, chat_id: &ChatId) -> GroupChatKey {
        // ChatId bytes    The remaining bytes
        let principal = Principal::from(*chat_id);
        let id_bytes = principal.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(id_bytes);
        GroupChatKey(bytes)
    }
}

impl GroupChatKey {
    pub fn chat_id(&self) -> ChatId {
        Principal::from_slice(&self.0[1..]).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{RngExt, rng};

    #[test]
    fn group_chat_key_e2e() {
        for _ in 0..100 {
            let id_bytes: [u8; 10] = rng().random();
            let chat_id: ChatId = Principal::from_slice(&id_bytes).into();

            let prefix = GroupChatKeyPrefix::new();
            let key = prefix.create_key(&chat_id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::GroupChat as u8);
            assert_eq!(key_bytes.len(), 11);
            assert_eq!(KeyType::GroupChat.map_class(), MapClass::Default);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.chat_id(), chat_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: GroupChatKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }
}
