use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};

// The P2P swaps the user has created or accepted, keyed by swap id.
//
// Each user canister currently holds a single user, so the prefix is just the key type.
key!(P2PSwapKey, P2PSwapKeyPrefix, KeyType::P2PSwap);

impl P2PSwapKeyPrefix {
    pub fn new() -> Self {
        // KeyType::P2PSwap     1 byte
        P2PSwapKeyPrefix(vec![KeyType::P2PSwap as u8])
    }
}

impl Default for P2PSwapKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for P2PSwapKeyPrefix {
    type Key = P2PSwapKey;
    type Suffix = u32;

    fn create_key(&self, swap_id: &u32) -> P2PSwapKey {
        // Swap id          4 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&swap_id.to_be_bytes());
        P2PSwapKey(bytes)
    }
}

impl P2PSwapKey {
    pub fn swap_id(&self) -> u32 {
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
    fn p2p_swap_key_e2e() {
        for _ in 0..100 {
            let swap_id = rng().next_u32();

            let prefix = P2PSwapKeyPrefix::new();
            let key = prefix.create_key(&swap_id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::P2PSwap as u8);
            assert_eq!(key_bytes.len(), 5);
            assert_eq!(KeyType::P2PSwap.map_class(), MapClass::Default);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.swap_id(), swap_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: P2PSwapKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn keys_are_ordered_by_swap_id() {
        let prefix = P2PSwapKeyPrefix::new();
        assert!(prefix.create_key(&255) < prefix.create_key(&256));
    }
}
