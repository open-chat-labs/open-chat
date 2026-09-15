use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};

// The user's streak insurance payments and claims, each keyed by its position in the order they
// were made.
//
// Each user canister currently holds a single user, so the prefixes are just the key type.
key!(
    StreakInsuranceKey,
    StreakInsuranceKeyPrefix,
    KeyType::StreakInsurancePayment | KeyType::StreakInsuranceClaim
);

impl StreakInsuranceKeyPrefix {
    pub fn new_for_payments() -> Self {
        // KeyType::StreakInsurancePayment  1 byte
        StreakInsuranceKeyPrefix(vec![KeyType::StreakInsurancePayment as u8])
    }

    pub fn new_for_claims() -> Self {
        // KeyType::StreakInsuranceClaim    1 byte
        StreakInsuranceKeyPrefix(vec![KeyType::StreakInsuranceClaim as u8])
    }
}

impl KeyPrefix for StreakInsuranceKeyPrefix {
    type Key = StreakInsuranceKey;
    type Suffix = u32;

    fn create_key(&self, index: &u32) -> StreakInsuranceKey {
        // Index            4 bytes
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&index.to_be_bytes());
        StreakInsuranceKey(bytes)
    }
}

impl StreakInsuranceKey {
    pub fn index(&self) -> u32 {
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
    fn streak_insurance_key_e2e() {
        for (prefix, key_type) in [
            (StreakInsuranceKeyPrefix::new_for_payments(), KeyType::StreakInsurancePayment),
            (StreakInsuranceKeyPrefix::new_for_claims(), KeyType::StreakInsuranceClaim),
        ] {
            for _ in 0..100 {
                let index = rng().next_u32();

                let key = prefix.create_key(&index);
                let key_bytes = key.0.clone();

                assert_eq!(key_bytes[0], key_type as u8);
                assert_eq!(key_bytes.len(), 5);
                assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                assert!(key.matches_prefix(&prefix));
                assert_eq!(key.index(), index);

                let serialized = msgpack::serialize_then_unwrap(&key);
                assert_eq!(serialized.len(), key_bytes.len() + 2);
                let deserialized: StreakInsuranceKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, key);
                assert_eq!(deserialized.0, key_bytes);
                assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
            }
        }
    }

    #[test]
    fn keys_are_ordered_by_index() {
        let prefix = StreakInsuranceKeyPrefix::new_for_payments();
        assert!(prefix.create_key(&255) < prefix.create_key(&256));
        assert!(
            !prefix
                .create_key(&1)
                .matches_prefix(&StreakInsuranceKeyPrefix::new_for_claims())
        );
    }
}
