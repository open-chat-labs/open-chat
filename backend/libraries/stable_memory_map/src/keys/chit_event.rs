use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use types::TimestampMillis;

// The events which changed a user's CHIT balance, ordered by timestamp. Each key also holds a
// sequence number so that events with the same timestamp have distinct keys.
//
// Each user canister currently holds a single user, so the prefix is just the key type.
key!(ChitEventKey, ChitEventKeyPrefix, KeyType::ChitEvent);

impl ChitEventKeyPrefix {
    pub fn new() -> Self {
        // KeyType::ChitEvent   1 byte
        ChitEventKeyPrefix(vec![KeyType::ChitEvent as u8])
    }
}

impl Default for ChitEventKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for ChitEventKeyPrefix {
    type Key = ChitEventKey;
    type Suffix = (TimestampMillis, u32);

    fn create_key(&self, (timestamp, sequence): &(TimestampMillis, u32)) -> ChitEventKey {
        // Timestamp        8 bytes
        // Sequence         4 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 12);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&timestamp.to_be_bytes());
        bytes.extend_from_slice(&sequence.to_be_bytes());
        ChitEventKey(bytes)
    }
}

impl ChitEventKey {
    pub fn timestamp(&self) -> TimestampMillis {
        let start = self.0.len() - 12;
        let end = start + 8;
        u64::from_be_bytes(self.0[start..end].try_into().unwrap())
    }

    pub fn sequence(&self) -> u32 {
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
    fn chit_event_key_e2e() {
        for _ in 0..100 {
            let timestamp = rng().next_u64();
            let sequence = rng().next_u32();

            let prefix = ChitEventKeyPrefix::new();
            let key = prefix.create_key(&(timestamp, sequence));
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::ChitEvent as u8);
            assert_eq!(key_bytes.len(), 13);
            assert_eq!(KeyType::ChitEvent.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.timestamp(), timestamp);
            assert_eq!(key.sequence(), sequence);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: ChitEventKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn keys_are_ordered_by_timestamp_then_sequence() {
        let prefix = ChitEventKeyPrefix::new();
        assert!(prefix.create_key(&(1, u32::MAX)) < prefix.create_key(&(2, 0)));
        assert!(prefix.create_key(&(2, 0)) < prefix.create_key(&(2, 1)));
    }
}
