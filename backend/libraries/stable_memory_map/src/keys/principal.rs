use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;

key!(PrincipalKey, PrincipalKeyPrefix, KeyType::PrincipalToUserId);

impl PrincipalKeyPrefix {
    pub fn new() -> Self {
        // KeyType::PrincipalToUserId   1 byte
        PrincipalKeyPrefix(vec![KeyType::PrincipalToUserId as u8])
    }
}

impl KeyPrefix for PrincipalKeyPrefix {
    type Key = PrincipalKey;
    type Suffix = Principal;

    fn create_key(&self, principal: &Principal) -> PrincipalKey {
        let principal_bytes = principal.as_slice();
        let mut bytes = Vec::with_capacity(principal_bytes.len() + 1);
        bytes.push(KeyType::PrincipalToUserId as u8);
        bytes.extend_from_slice(principal_bytes);
        PrincipalKey(bytes)
    }
}

impl Default for PrincipalKeyPrefix {
    fn default() -> Self {
        Self::new()
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
    use crate::{BaseKey, Key};
    use rand::{thread_rng, RngCore};

    #[test]
    fn principal_to_user_id_key_e2e() {
        for _ in 0..100 {
            let prefix = PrincipalKeyPrefix::new();
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
}
