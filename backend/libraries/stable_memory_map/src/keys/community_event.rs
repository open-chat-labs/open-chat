use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use types::EventIndex;

key!(CommunityEventKey, CommunityEventKeyPrefix, KeyType::CommunityEvent);

impl CommunityEventKeyPrefix {
    pub fn new() -> Self {
        // KeyType::CommunityEvent      1 byte
        CommunityEventKeyPrefix(vec![KeyType::CommunityEvent as u8])
    }
}

impl KeyPrefix for CommunityEventKeyPrefix {
    type Key = CommunityEventKey;
    type Suffix = EventIndex;

    fn create_key(&self, event_index: &EventIndex) -> CommunityEventKey {
        let mut bytes = Vec::with_capacity(5);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(*event_index).to_be_bytes());
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key};
    use rand::{thread_rng, RngCore};
    use types::EventIndex;

    #[test]
    fn community_event_key_e2e() {
        for _ in 0..100 {
            let prefix = CommunityEventKeyPrefix::new();
            let event_index = EventIndex::from(thread_rng().next_u32());
            let key = BaseKey::from(prefix.create_key(&event_index));
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
