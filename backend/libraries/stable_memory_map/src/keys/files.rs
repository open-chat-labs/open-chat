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
