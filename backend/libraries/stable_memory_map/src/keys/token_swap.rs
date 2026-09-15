use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};

// The user's token swaps, keyed by swap id.
//
// Each user canister currently holds a single user, so the prefix is just the key type.
key!(TokenSwapKey, TokenSwapKeyPrefix, KeyType::TokenSwap);

impl TokenSwapKeyPrefix {
    pub fn new() -> Self {
        // KeyType::TokenSwap   1 byte
        TokenSwapKeyPrefix(vec![KeyType::TokenSwap as u8])
    }
}

impl Default for TokenSwapKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for TokenSwapKeyPrefix {
    type Key = TokenSwapKey;
    type Suffix = u128;

    fn create_key(&self, swap_id: &u128) -> TokenSwapKey {
        // Swap id          16 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 16);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&swap_id.to_be_bytes());
        TokenSwapKey(bytes)
    }
}

impl TokenSwapKey {
    pub fn swap_id(&self) -> u128 {
        let start = self.0.len() - 16;
        u128::from_be_bytes(self.0[start..].try_into().unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{Rng, rng};

    #[test]
    fn token_swap_key_e2e() {
        for _ in 0..100 {
            let swap_id = ((rng().next_u64() as u128) << 64) | rng().next_u64() as u128;

            let prefix = TokenSwapKeyPrefix::new();
            let key = prefix.create_key(&swap_id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::TokenSwap as u8);
            assert_eq!(key_bytes.len(), 17);
            assert_eq!(KeyType::TokenSwap.map_class(), MapClass::Default);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.swap_id(), swap_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: TokenSwapKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn keys_are_ordered_by_swap_id() {
        let prefix = TokenSwapKeyPrefix::new();
        assert!(prefix.create_key(&1) < prefix.create_key(&2));
        assert!(prefix.create_key(&u64::MAX.into()) < prefix.create_key(&(u64::MAX as u128 + 1)));
    }
}
