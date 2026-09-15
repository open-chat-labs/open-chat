use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::TimestampMillis;

// The direct chats, groups and communities which a user has been removed from, ordered by when
// they were removed.
//
// Each user canister currently holds a single user, so the prefixes are just the key type.
key!(
    RemovedChatKey,
    RemovedChatKeyPrefix,
    KeyType::DirectChatRemoved | KeyType::GroupChatRemoved | KeyType::CommunityRemoved
);

impl RemovedChatKeyPrefix {
    pub fn new_for_direct_chats() -> Self {
        // KeyType::DirectChatRemoved   1 byte
        RemovedChatKeyPrefix(vec![KeyType::DirectChatRemoved as u8])
    }

    pub fn new_for_group_chats() -> Self {
        // KeyType::GroupChatRemoved    1 byte
        RemovedChatKeyPrefix(vec![KeyType::GroupChatRemoved as u8])
    }

    pub fn new_for_communities() -> Self {
        // KeyType::CommunityRemoved    1 byte
        RemovedChatKeyPrefix(vec![KeyType::CommunityRemoved as u8])
    }
}

impl KeyPrefix for RemovedChatKeyPrefix {
    type Key = RemovedChatKey;
    type Suffix = (TimestampMillis, Principal);

    fn create_key(&self, (timestamp, chat_id): &(TimestampMillis, Principal)) -> RemovedChatKey {
        // Timestamp        8 bytes
        // Chat id bytes    The remaining bytes
        let chat_id_bytes = chat_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + 8 + chat_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&timestamp.to_be_bytes());
        bytes.extend_from_slice(chat_id_bytes);
        RemovedChatKey(bytes)
    }
}

impl RemovedChatKey {
    pub fn timestamp(&self) -> TimestampMillis {
        u64::from_be_bytes(self.0[1..9].try_into().unwrap())
    }

    pub fn chat_id(&self) -> Principal {
        Principal::from_slice(&self.0[9..])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{Rng, RngExt, rng};

    #[test]
    fn removed_chat_key_e2e() {
        for (prefix, key_type) in [
            (RemovedChatKeyPrefix::new_for_direct_chats(), KeyType::DirectChatRemoved),
            (RemovedChatKeyPrefix::new_for_group_chats(), KeyType::GroupChatRemoved),
            (RemovedChatKeyPrefix::new_for_communities(), KeyType::CommunityRemoved),
        ] {
            for _ in 0..100 {
                let chat_id_bytes: [u8; 10] = rng().random();
                let chat_id = Principal::from_slice(&chat_id_bytes);
                let timestamp = rng().next_u64();

                let key = prefix.create_key(&(timestamp, chat_id));
                let key_bytes = key.0.clone();

                assert_eq!(key_bytes[0], key_type as u8);
                assert_eq!(key_bytes.len(), 19);
                assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                assert!(key.matches_prefix(&prefix));
                assert_eq!(key.timestamp(), timestamp);
                assert_eq!(key.chat_id(), chat_id);

                let serialized = msgpack::serialize_then_unwrap(&key);
                assert_eq!(serialized.len(), key_bytes.len() + 2);
                let deserialized: RemovedChatKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, key);
                assert_eq!(deserialized.0, key_bytes);
                assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
            }
        }
    }

    #[test]
    fn keys_are_ordered_by_timestamp() {
        let prefix = RemovedChatKeyPrefix::new_for_group_chats();
        let high = Principal::from_slice(&[u8::MAX; 10]);
        let low = Principal::from_slice(&[0; 10]);
        assert!(prefix.create_key(&(255, high)) < prefix.create_key(&(256, low)));
        assert!(
            !prefix
                .create_key(&(1, low))
                .matches_prefix(&RemovedChatKeyPrefix::new_for_communities())
        );
    }
}
