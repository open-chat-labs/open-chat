use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::UserId;

// The users the user has blocked, keyed by user id, with empty values. Not to be confused with
// `KeyType::BlockedUsers`, which the user index canisters use for pairs of user ids.
//
// Each user canister currently holds a single user, so the prefix is just the key type.
key!(BlockedUserKey, BlockedUserKeyPrefix, KeyType::BlockedUser);

impl BlockedUserKeyPrefix {
    pub fn new() -> Self {
        // KeyType::BlockedUser     1 byte
        BlockedUserKeyPrefix(vec![KeyType::BlockedUser as u8])
    }
}

impl Default for BlockedUserKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for BlockedUserKeyPrefix {
    type Key = BlockedUserKey;
    type Suffix = UserId;

    fn create_key(&self, user_id: &UserId) -> BlockedUserKey {
        // UserId           variable
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + user_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(user_id_bytes);
        BlockedUserKey(bytes)
    }
}

impl BlockedUserKey {
    pub fn user_id(&self) -> UserId {
        // The prefix is just the key type
        Principal::from_slice(&self.0[1..]).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{RngExt, rng};

    #[test]
    fn blocked_user_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = rng().random();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));

            let prefix = BlockedUserKeyPrefix::new();
            let key = prefix.create_key(&user_id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::BlockedUser as u8);
            assert_eq!(key_bytes.len(), 11);
            assert_eq!(KeyType::BlockedUser.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: BlockedUserKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }
}
