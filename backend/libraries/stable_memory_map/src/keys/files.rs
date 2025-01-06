use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use types::{AccessorId, FileId, Hash};

key!(FileIdToFileKey, FileIdToFileKeyPrefix, KeyType::FileIdToFile);

impl FileIdToFileKeyPrefix {
    pub fn new() -> Self {
        // KeyType::FileIdToFile    1 byte
        FileIdToFileKeyPrefix(vec![KeyType::FileIdToFile as u8])
    }
}

impl KeyPrefix for FileIdToFileKeyPrefix {
    type Key = FileIdToFileKey;
    type Suffix = FileId;

    fn create_key(&self, file_id: &FileId) -> FileIdToFileKey {
        let mut bytes = Vec::with_capacity(17);
        bytes.push(KeyType::FileIdToFile as u8);
        bytes.extend_from_slice(&file_id.to_be_bytes());
        FileIdToFileKey(bytes)
    }
}

impl Default for FileIdToFileKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl FileIdToFileKey {
    pub fn file_id(&self) -> FileId {
        FileId::from_be_bytes(self.0[1..].try_into().unwrap())
    }
}

key!(
    FileReferenceCountKey,
    FileReferenceCountKeyPrefix,
    KeyType::FileReferenceCount
);

impl FileReferenceCountKeyPrefix {
    pub fn new() -> Self {
        // KeyType::FileReferenceCount  1 byte
        FileReferenceCountKeyPrefix(vec![KeyType::FileReferenceCount as u8])
    }
}

impl KeyPrefix for FileReferenceCountKeyPrefix {
    type Key = FileReferenceCountKey;
    type Suffix = Hash;

    fn create_key(&self, hash: &Hash) -> FileReferenceCountKey {
        let mut bytes = Vec::with_capacity(33);
        bytes.push(KeyType::FileReferenceCount as u8);
        bytes.extend_from_slice(hash);
        FileReferenceCountKey(bytes)
    }
}

impl Default for FileReferenceCountKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl FileReferenceCountKey {
    pub fn hash(&self) -> Hash {
        self.0[1..].try_into().unwrap()
    }
}

key!(FilesPerAccessorKey, FilesPerAccessorKeyPrefix, KeyType::FilesPerAccessor);

impl FilesPerAccessorKeyPrefix {
    pub fn new() -> Self {
        // KeyType::FilesPerAccessor    1 byte
        FilesPerAccessorKeyPrefix(vec![KeyType::FilesPerAccessor as u8])
    }
}

impl KeyPrefix for FilesPerAccessorKeyPrefix {
    type Key = FilesPerAccessorKey;
    type Suffix = (AccessorId, FileId);

    fn create_key(&self, (accessor_id, file_id): &(AccessorId, FileId)) -> FilesPerAccessorKey {
        let accessor_bytes = accessor_id.as_slice();
        let mut bytes = Vec::with_capacity(accessor_bytes.len() + 17);
        bytes.push(KeyType::FilesPerAccessor as u8);
        bytes.extend_from_slice(accessor_bytes);
        bytes.extend_from_slice(&file_id.to_be_bytes());
        FilesPerAccessorKey(bytes)
    }
}

impl Default for FilesPerAccessorKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl FilesPerAccessorKey {
    pub fn accessor_id(&self) -> AccessorId {
        let end = self.0.len() - 16;
        AccessorId::from_slice(&self.0[1..end])
    }

    pub fn file_id(&self) -> FileId {
        let start = self.0.len() - 16;
        FileId::from_be_bytes(self.0[start..].try_into().unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key};
    use rand::{thread_rng, Rng};

    #[test]
    fn file_id_to_file_key_e2e() {
        for _ in 0..100 {
            let file_id: u128 = thread_rng().gen();
            let prefix = FileIdToFileKeyPrefix::new();
            let key = BaseKey::from(prefix.create_key(&file_id));
            let file_key = FileIdToFileKey::try_from(key.clone()).unwrap();

            assert_eq!(*file_key.0.first().unwrap(), KeyType::FileIdToFile as u8);
            assert_eq!(file_key.0.len(), 17);
            assert!(file_key.matches_prefix(&prefix));
            assert_eq!(file_key.file_id(), file_id);

            let serialized = msgpack::serialize_then_unwrap(&file_key);
            assert_eq!(serialized.len(), file_key.0.len() + 2);
            let deserialized: FileIdToFileKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, file_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn file_reference_count_key_e2e() {
        for _ in 0..100 {
            let hash: [u8; 32] = thread_rng().gen();
            let prefix = FileReferenceCountKeyPrefix::new();
            let key = BaseKey::from(prefix.create_key(&hash));
            let reference_count_key = FileReferenceCountKey::try_from(key.clone()).unwrap();

            assert_eq!(*reference_count_key.0.first().unwrap(), KeyType::FileReferenceCount as u8);
            assert_eq!(reference_count_key.0.len(), 33);
            assert!(reference_count_key.matches_prefix(&prefix));
            assert_eq!(reference_count_key.hash(), hash);

            let serialized = msgpack::serialize_then_unwrap(&reference_count_key);
            assert_eq!(serialized.len(), reference_count_key.0.len() + 2);
            let deserialized: FileReferenceCountKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, reference_count_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn files_per_accessor_key_e2e() {
        for _ in 0..100 {
            let accessor_id_bytes: [u8; 10] = thread_rng().gen();
            let accessor_id = AccessorId::from_slice(&accessor_id_bytes);
            let file_id: u128 = thread_rng().gen();
            let prefix = FilesPerAccessorKeyPrefix::new();
            let key = BaseKey::from(prefix.create_key(&(accessor_id, file_id)));
            let member_key = FilesPerAccessorKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::FilesPerAccessor as u8);
            assert_eq!(member_key.0.len(), 27);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.accessor_id(), accessor_id);
            assert_eq!(member_key.file_id(), file_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: FilesPerAccessorKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }
}
