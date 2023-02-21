use crate::memory::{
    get_blob_reference_counts_memory, get_blob_sizes_memory, get_files_by_user_memory, get_total_blob_bytes_memory,
    get_total_file_bytes_memory, Memory,
};
use candid::Principal;
use ic_stable_structures::{BoundedStorable, StableBTreeMap, StableCell, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use types::{CanisterId, FileAdded, FileId, FileRemoved, Hash, TimestampMillis};

#[derive(Serialize, Deserialize)]
pub struct Files {
    #[serde(skip, default = "init_files_by_user")]
    files_by_user: StableBTreeMap<FileIdByUserThenCreated, HashAndBucket, Memory>,
    #[serde(skip, default = "init_blob_reference_counts")]
    blob_reference_counts: StableBTreeMap<BlobReference, u32, Memory>,
    #[serde(skip, default = "init_blob_sizes")]
    blob_sizes: StableBTreeMap<Hash, u64, Memory>,
    #[serde(skip, default = "init_total_file_bytes")]
    total_file_bytes: StableCell<u64, Memory>,
    #[serde(skip, default = "init_total_blob_bytes")]
    total_blob_bytes: StableCell<u64, Memory>,
}

impl Files {
    pub fn add(&mut self, file: FileAdded, bucket: CanisterId) {
        if let Some(existing) = self
            .files_by_user
            .insert((&file).into(), HashAndBucket { hash: file.hash, bucket })
        {
            if existing.hash == file.hash && existing.bucket == bucket {
                return;
            } else {
                panic!("FileId already in use! {}", file.file_id);
            }
        }

        let blob_reference = BlobReference {
            hash: file.hash,
            user_id: file.meta_data.owner,
            canister_id: bucket,
        };

        let count = self
            .blob_reference_counts
            .get(&blob_reference)
            .unwrap_or_default()
            .saturating_add(1);

        self.blob_reference_counts.insert(blob_reference, count);

        let total_file_bytes = self.total_file_bytes.get().saturating_add(file.size);
        self.total_file_bytes.set(total_file_bytes).unwrap();

        if count == 1 {
            self.blob_sizes.insert(file.hash, file.size);
            let total_blob_bytes = self.total_blob_bytes.get().saturating_add(file.size);
            self.total_blob_bytes.set(total_blob_bytes).unwrap();
        }
    }

    pub fn remove(&mut self, file: FileRemoved, bucket: CanisterId) -> Result<RemoveFileSuccess, ()> {
        if let Some(HashAndBucket { hash, .. }) = self.files_by_user.remove(&(&file).into()) {
            let blob_reference = BlobReference {
                hash,
                user_id: file.meta_data.owner,
                canister_id: bucket,
            };

            let count_remaining = self
                .blob_reference_counts
                .get(&blob_reference)
                .unwrap_or_default()
                .saturating_sub(1);

            let mut size = None;
            if count_remaining == 0 {
                self.blob_reference_counts.remove(&blob_reference);
                if self.iter_blob_reference_counts(hash, None).next().is_none() {
                    size = self.blob_sizes.remove(&hash);
                    if let Some(blob_size) = size {
                        let total_blob_bytes = self.total_blob_bytes.get().saturating_sub(blob_size);
                        self.total_blob_bytes.set(total_blob_bytes).unwrap();
                    }
                }
            } else {
                self.blob_reference_counts.insert(blob_reference, count_remaining);
            }

            let size = size.or_else(|| self.blob_sizes.get(&hash)).unwrap_or_default();
            let total_file_bytes = self.total_file_bytes.get().saturating_sub(size);
            self.total_file_bytes.set(total_file_bytes).unwrap();

            Ok(RemoveFileSuccess { hash, size })
        } else {
            Err(())
        }
    }

    pub fn blob_size(&self, hash: &Hash) -> Option<u64> {
        self.blob_sizes.get(hash)
    }

    pub fn user_owns_blob(&self, user_id: Principal, hash: Hash) -> bool {
        self.iter_blob_reference_counts(hash, Some(user_id)).next().is_some()
    }

    pub fn bucket_for_blob(&self, hash: Hash) -> Option<CanisterId> {
        self.iter_blob_reference_counts(hash, None).next().map(|(r, _)| r.canister_id)
    }

    pub fn iter_user_files_from_oldest(&self, user_id: Principal) -> impl Iterator<Item = UserFile> + '_ {
        self.iter_user_files_from_oldest_internal(user_id).map(|(k, v)| UserFile {
            file_id: k.file_id,
            created: k.created,
            hash: v.hash,
            bucket: v.bucket,
        })
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            file_count: self.files_by_user.len(),
            total_file_bytes: *self.total_file_bytes.get(),
            blob_count: self.blob_sizes.len(),
            total_blob_bytes: *self.total_blob_bytes.get(),
        }
    }

    fn iter_user_files_from_oldest_internal(
        &self,
        user_id: Principal,
    ) -> impl Iterator<Item = (FileIdByUserThenCreated, HashAndBucket)> + '_ {
        let range_start = FileIdByUserThenCreated {
            user_id,
            created: 0,
            file_id: 0,
        };
        self.files_by_user
            .range(range_start..)
            .take_while(move |(k, _)| k.user_id == user_id)
    }

    fn iter_blob_reference_counts(
        &self,
        hash: Hash,
        user_id: Option<Principal>,
    ) -> impl Iterator<Item = (BlobReference, u32)> + '_ {
        let range_start = BlobReference {
            hash,
            user_id: user_id.unwrap_or(Principal::from_slice(&[])),
            canister_id: CanisterId::from_slice(&[]),
        };
        self.blob_reference_counts
            .range(range_start..)
            .take_while(move |(r, _)| r.hash == hash && user_id.map_or(true, |u| u == r.user_id))
    }
}

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct FileIdByUserThenCreated {
    user_id: Principal,
    created: TimestampMillis,
    file_id: FileId,
}

impl FileIdByUserThenCreated {
    const MAX_SIZE: usize = 29 /* user_id */ + 8 /* created */ + 16 /* file_id */;
}

impl From<&FileAdded> for FileIdByUserThenCreated {
    fn from(value: &FileAdded) -> Self {
        FileIdByUserThenCreated {
            user_id: value.meta_data.owner,
            created: value.meta_data.created,
            file_id: value.file_id,
        }
    }
}

impl From<&FileRemoved> for FileIdByUserThenCreated {
    fn from(value: &FileRemoved) -> Self {
        FileIdByUserThenCreated {
            user_id: value.meta_data.owner,
            created: value.meta_data.created,
            file_id: value.file_id,
        }
    }
}

impl Storable for FileIdByUserThenCreated {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(Self::MAX_SIZE);
        bytes.extend_from_slice(self.user_id.as_slice());
        bytes.extend_from_slice(&self.created.to_be_bytes());
        bytes.extend_from_slice(&self.file_id.to_be_bytes());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let (remaining, file_id_bytes) = bytes.split_at(bytes.len() - 16);
        let (user_id_bytes, created_bytes) = remaining.split_at(remaining.len() - 8);

        Self {
            user_id: Principal::from_slice(user_id_bytes),
            created: u64::from_be_bytes(created_bytes.try_into().unwrap()),
            file_id: u128::from_be_bytes(file_id_bytes.try_into().unwrap()),
        }
    }
}

impl BoundedStorable for FileIdByUserThenCreated {
    const MAX_SIZE: u32 = Self::MAX_SIZE as u32;
    const IS_FIXED_SIZE: bool = false;
}

pub struct UserFile {
    pub file_id: FileId,
    pub created: TimestampMillis,
    pub hash: Hash,
    pub bucket: CanisterId,
}

pub struct HashAndBucket {
    pub hash: Hash,
    pub bucket: CanisterId,
}

impl HashAndBucket {
    const MAX_SIZE: usize = 32 /* hash */ + 29 /* bucket */;
}

impl Storable for HashAndBucket {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(Self::MAX_SIZE);
        bytes.extend_from_slice(&self.hash);
        bytes.extend_from_slice(self.bucket.as_slice());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let (hash_bytes, bucket_bytes) = bytes.split_at(32);

        Self {
            hash: hash_bytes.try_into().unwrap(),
            bucket: Principal::from_slice(bucket_bytes),
        }
    }
}

pub struct RemoveFileSuccess {
    pub hash: Hash,
    pub size: u64,
}

impl BoundedStorable for HashAndBucket {
    const MAX_SIZE: u32 = Self::MAX_SIZE as u32;
    const IS_FIXED_SIZE: bool = false;
}

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct BlobReference {
    hash: Hash,
    user_id: Principal,
    canister_id: CanisterId,
}

impl BlobReference {
    const MAX_SIZE: usize = 32 /* hash */ + 1 /* user_id_len */ + 29 /* user_id */ + 29 /* canister_id */;
}

impl Storable for BlobReference {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(Self::MAX_SIZE);
        bytes.extend_from_slice(&self.hash);
        let user_id_bytes = self.user_id.as_slice();
        bytes.push(user_id_bytes.len() as u8);
        bytes.extend_from_slice(user_id_bytes);
        bytes.extend_from_slice(self.canister_id.as_slice());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let (hash_bytes, remaining) = bytes.split_at(32);
        let (user_id_len, remaining) = remaining.split_at(1);
        let (user_id_bytes, canister_id_bytes) = remaining.split_at(user_id_len.first().copied().unwrap() as usize);

        Self {
            hash: hash_bytes.try_into().unwrap(),
            user_id: Principal::from_slice(user_id_bytes),
            canister_id: Principal::from_slice(canister_id_bytes),
        }
    }
}

impl BoundedStorable for BlobReference {
    const MAX_SIZE: u32 = Self::MAX_SIZE as u32;
    const IS_FIXED_SIZE: bool = false;
}

impl Default for Files {
    fn default() -> Self {
        Self {
            files_by_user: init_files_by_user(),
            blob_reference_counts: init_blob_reference_counts(),
            blob_sizes: init_blob_sizes(),
            total_file_bytes: init_total_file_bytes(),
            total_blob_bytes: init_total_blob_bytes(),
        }
    }
}

fn init_files_by_user() -> StableBTreeMap<FileIdByUserThenCreated, HashAndBucket, Memory> {
    let memory = get_files_by_user_memory();

    StableBTreeMap::init(memory)
}

fn init_blob_reference_counts() -> StableBTreeMap<BlobReference, u32, Memory> {
    let memory = get_blob_reference_counts_memory();

    StableBTreeMap::init(memory)
}

fn init_blob_sizes() -> StableBTreeMap<Hash, u64, Memory> {
    let memory = get_blob_sizes_memory();

    StableBTreeMap::init(memory)
}

fn init_total_file_bytes() -> StableCell<u64, Memory> {
    let memory = get_total_file_bytes_memory();

    StableCell::init(memory, 0).unwrap()
}

fn init_total_blob_bytes() -> StableCell<u64, Memory> {
    let memory = get_total_blob_bytes_memory();

    StableCell::init(memory, 0).unwrap()
}

pub struct Metrics {
    pub file_count: u64,
    pub total_file_bytes: u64,
    pub blob_count: u64,
    pub total_blob_bytes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::FileMetaData;

    #[test]
    fn iter_user_files_from_oldest_returns_oldest_first() {
        let mut files = Files::default();
        let user_id = Principal::from_slice(&[1]);
        let bucket = CanisterId::from_slice(&[2]);

        for i in 0u8..10 {
            files.add(
                FileAdded {
                    file_id: i.into(),
                    hash: [i; 32],
                    size: i.into(),
                    meta_data: FileMetaData {
                        owner: user_id,
                        created: i.into(),
                    },
                },
                bucket,
            );
        }

        let created_dates: Vec<_> = files.iter_user_files_from_oldest(user_id).map(|f| f.created).collect();

        assert_eq!(created_dates, (0u64..10).collect::<Vec<_>>())
    }

    #[test]
    fn iter_user_files_from_oldest_returns_files_for_correct_user() {
        let mut files = Files::default();
        let bucket = CanisterId::from_slice(&[2]);

        for u in 0..5 {
            let user_id = Principal::from_slice(&[u]);
            let start = u * 10;

            for i in start..(start + 10) {
                files.add(
                    FileAdded {
                        file_id: i.into(),
                        hash: [i; 32],
                        size: i.into(),
                        meta_data: FileMetaData {
                            owner: user_id,
                            created: i.into(),
                        },
                    },
                    bucket,
                );
            }
        }

        let created_dates: Vec<_> = files
            .iter_user_files_from_oldest(Principal::from_slice(&[3]))
            .map(|f| f.created)
            .collect();

        assert_eq!(created_dates, (30u64..40).collect::<Vec<_>>())
    }

    #[test]
    fn add_then_remove_leaves_empty() {
        let mut files = Files::default();
        let user_id = Principal::from_slice(&[1]);
        let bucket = CanisterId::from_slice(&[2]);

        for i in 0u8..10 {
            files.add(
                FileAdded {
                    file_id: i.into(),
                    hash: [i; 32],
                    size: i.into(),
                    meta_data: FileMetaData {
                        owner: user_id,
                        created: i.into(),
                    },
                },
                bucket,
            );
        }

        for i in 0u8..10 {
            files
                .remove(
                    FileRemoved {
                        file_id: i.into(),
                        meta_data: FileMetaData {
                            owner: user_id,
                            created: i.into(),
                        },
                    },
                    bucket,
                )
                .unwrap();
        }

        assert!(files.files_by_user.is_empty());
        assert!(files.blob_reference_counts.is_empty());
        assert!(files.blob_sizes.is_empty());
        assert_eq!(*files.total_file_bytes.get(), 0);
        assert_eq!(*files.total_blob_bytes.get(), 0);
    }
}
