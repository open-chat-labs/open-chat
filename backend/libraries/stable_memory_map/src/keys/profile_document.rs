use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};

// The user's avatar and profile background, keyed by which of the two the document is.
//
// Each user canister currently holds a single user, so the prefix is just the key type.
key!(ProfileDocumentKey, ProfileDocumentKeyPrefix, KeyType::ProfileDocument);

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum ProfileDocumentType {
    Avatar = 0,
    ProfileBackground = 1,
}

impl ProfileDocumentKeyPrefix {
    pub fn new() -> Self {
        // KeyType::ProfileDocument     1 byte
        ProfileDocumentKeyPrefix(vec![KeyType::ProfileDocument as u8])
    }
}

impl Default for ProfileDocumentKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for ProfileDocumentKeyPrefix {
    type Key = ProfileDocumentKey;
    type Suffix = ProfileDocumentType;

    fn create_key(&self, document_type: &ProfileDocumentType) -> ProfileDocumentKey {
        // ProfileDocumentType     1 byte
        let mut bytes = Vec::with_capacity(self.0.len() + 1);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.push(*document_type as u8);
        ProfileDocumentKey(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};

    #[test]
    fn profile_document_key_e2e() {
        for document_type in [ProfileDocumentType::Avatar, ProfileDocumentType::ProfileBackground] {
            let prefix = ProfileDocumentKeyPrefix::new();
            let key = prefix.create_key(&document_type);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes, vec![KeyType::ProfileDocument as u8, document_type as u8]);
            assert_eq!(KeyType::ProfileDocument.map_class(), MapClass::Default);
            assert!(key.matches_prefix(&prefix));

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: ProfileDocumentKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }

        let avatar = ProfileDocumentKeyPrefix::new().create_key(&ProfileDocumentType::Avatar);
        let profile_background = ProfileDocumentKeyPrefix::new().create_key(&ProfileDocumentType::ProfileBackground);
        assert_ne!(avatar, profile_background);
    }
}
