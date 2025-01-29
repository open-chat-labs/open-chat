use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;

key!(
    PrincipalKey,
    PrincipalKeyPrefix,
    KeyType::PrincipalToUserId | KeyType::UserStorageRecord
);

impl PrincipalKeyPrefix {
    pub fn new_for_principal_to_user_id_map() -> Self {
        // KeyType::PrincipalToUserId   1 byte
        PrincipalKeyPrefix(vec![KeyType::PrincipalToUserId as u8])
    }

    pub fn new_for_storage_record() -> Self {
        // KeyType::UserStorageRecord   1 byte
        PrincipalKeyPrefix(vec![KeyType::UserStorageRecord as u8])
    }
}

impl KeyPrefix for PrincipalKeyPrefix {
    type Key = PrincipalKey;
    type Suffix = Principal;

    fn create_key(&self, principal: &Principal) -> PrincipalKey {
        let principal_bytes = principal.as_slice();
        let mut bytes = Vec::with_capacity(principal_bytes.len() + 1);
        bytes.extend_from_slice(&self.0);
        bytes.extend_from_slice(principal_bytes);
        PrincipalKey(bytes)
    }
}

impl PrincipalKey {
    pub fn principal(&self) -> Principal {
        Principal::from_slice(&self.0[1..])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, UserStorageRecordKey, UserStorageRecordKeyPrefix};
    use rand::{thread_rng, Rng, RngCore};

    #[test]
    fn principal_to_user_id_key_e2e() {
        for _ in 0..100 {
            let prefix = PrincipalKeyPrefix::new_for_principal_to_user_id_map();
            let principal = Principal::from_slice(&thread_rng().next_u32().to_be_bytes());
            let key = BaseKey::from(prefix.create_key(&principal));
            let principal_to_user_id_key = PrincipalKey::try_from(key.clone()).unwrap();

            assert_eq!(*principal_to_user_id_key.0.first().unwrap(), KeyType::PrincipalToUserId as u8);
            assert_eq!(principal_to_user_id_key.0.len(), principal.as_slice().len() + 1);
            assert!(principal_to_user_id_key.matches_prefix(&prefix));
            assert_eq!(principal_to_user_id_key.principal(), principal);

            let serialized = msgpack::serialize_then_unwrap(&principal_to_user_id_key);
            assert_eq!(serialized.len(), principal_to_user_id_key.0.len() + 2);
            let deserialized: PrincipalKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, principal_to_user_id_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn user_storage_record_key_e2e() {
        for _ in 0..100 {
            let principal_bytes: [u8; 29] = thread_rng().gen();
            let principal = Principal::from_slice(&principal_bytes);
            let prefix = PrincipalKeyPrefix::new_for_storage_record();
            let key = BaseKey::from(prefix.create_key(&principal));
            let storage_record_key = PrincipalKey::try_from(key.clone()).unwrap();

            assert_eq!(*storage_record_key.0.first().unwrap(), KeyType::UserStorageRecord as u8);
            assert_eq!(storage_record_key.0.len(), 30);
            assert!(storage_record_key.matches_prefix(&prefix));
            assert_eq!(storage_record_key.principal(), principal);

            let serialized = msgpack::serialize_then_unwrap(&storage_record_key);
            assert_eq!(serialized.len(), storage_record_key.0.len() + 2);
            let deserialized: PrincipalKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, storage_record_key);
            assert_eq!(deserialized.0, key.0);
        }
    }
}
