use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::CommunityId;

// The user's records of the communities the user is in, each serialized whole and keyed by the community's id.
//
// In a canister which holds many users the key is scoped to the user (see `key_scope`), so the
// prefix is just the key type.
key!(CommunityKey, CommunityKeyPrefix, KeyType::Community);

impl CommunityKeyPrefix {
    pub fn new() -> Self {
        // KeyType::Community     1 byte
        CommunityKeyPrefix(vec![KeyType::Community as u8])
    }
}

impl Default for CommunityKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for CommunityKeyPrefix {
    type Key = CommunityKey;
    type Suffix = CommunityId;

    fn create_key(&self, community_id: &CommunityId) -> CommunityKey {
        // CommunityId bytes    The remaining bytes
        let principal = Principal::from(*community_id);
        let id_bytes = principal.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(id_bytes);
        CommunityKey(bytes)
    }
}

impl CommunityKey {
    pub fn community_id(&self) -> CommunityId {
        Principal::from_slice(&self.0[1..]).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{RngExt, rng};

    #[test]
    fn community_key_e2e() {
        for _ in 0..100 {
            let id_bytes: [u8; 10] = rng().random();
            let community_id: CommunityId = Principal::from_slice(&id_bytes).into();

            let prefix = CommunityKeyPrefix::new();
            let key = prefix.create_key(&community_id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::Community as u8);
            assert_eq!(key_bytes.len(), 11);
            assert_eq!(KeyType::Community.map_class(), MapClass::Default);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.community_id(), community_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: CommunityKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }
}
