use crate::model::files_map::FilesMap;
use crate::model::files_per_accessor_map::FilesPerAccessorStableMap;
use crate::model::reference_counts::ReferenceCountsStableMap;
use crate::model::stable_blob_storage::StableBlobStorage;
use crate::{calc_chunk_count, MAX_BLOB_SIZE_BYTES};
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::cmp::Ordering;
use std::collections::btree_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, BTreeSet};
use storage_bucket_canister::upload_chunk_v2::Args as UploadChunkArgs;
use types::{AccessorId, CanisterId, FileAdded, FileId, FileMetaData, FileRemoved, Hash, TimestampMillis};
use utils::file_id::generate_file_id;
use utils::hasher::hash_bytes;

#[cfg(test)]
mod proptests;

#[derive(Serialize, Deserialize, Default)]
pub struct Files {
    files: FilesMap,
    pending_files: BTreeMap<FileId, PendingFile>,
    reference_counts: ReferenceCountsStableMap,
    accessors_map: FilesPerAccessorStableMap,
    blobs: StableBlobStorage,
    #[serde(skip_deserializing)]
    expiration_queue: BTreeSet<(TimestampMillis, FileId)>,
    #[serde(alias = "bytes_used")]
    total_file_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct File {
    #[serde(rename = "o")]
    pub owner: Principal,
    #[serde(rename = "c")]
    pub created: TimestampMillis,
    #[serde(rename = "a")]
    pub accessors: BTreeSet<AccessorId>,
    #[serde(rename = "h")]
    pub hash: Hash,
    #[serde(rename = "m")]
    pub mime_type: String,
}

impl File {
    pub fn can_be_removed_by(&self, principal: Principal) -> bool {
        // TODO accessors should have roles rather than always being allowed to remove files
        self.owner == principal || self.accessors.contains(&principal)
    }

    pub fn meta_data(&self) -> FileMetaData {
        FileMetaData {
            owner: self.owner,
            created: self.created,
        }
    }
}

impl Files {
    pub fn get(&self, file_id: &FileId) -> Option<File> {
        self.files.get(file_id)
    }

    pub fn pending_file(&self, file_id: &FileId) -> Option<&PendingFile> {
        self.pending_files.get(file_id)
    }

    pub fn blob_bytes(&self, hash: &Hash) -> Option<Vec<u8>> {
        self.blobs.get(hash)
    }

    pub fn owner(&self, file_id: &FileId) -> Option<Principal> {
        self.get(file_id)
            .map(|f| f.owner)
            .or_else(|| self.pending_files.get(file_id).map(|f| f.owner))
    }

    pub fn put_chunk(&mut self, args: PutChunkArgs) -> PutChunkResult {
        if args.total_size > MAX_BLOB_SIZE_BYTES {
            return PutChunkResult::FileTooBig(MAX_BLOB_SIZE_BYTES);
        }

        if self.files.contains_key(&args.file_id) {
            return PutChunkResult::FileAlreadyExists;
        }

        if args.expiry.is_some_and(|e| e < args.now) {
            self.pending_files.remove(&args.file_id);
            return PutChunkResult::FileExpired;
        }

        let file_id = args.file_id;
        let mut file_added = None;

        let completed_file: Option<PendingFile> = match self.pending_files.entry(file_id) {
            Vacant(e) => {
                file_added = Some(FileAdded {
                    file_id,
                    hash: args.hash,
                    size: args.total_size,
                    meta_data: FileMetaData {
                        owner: args.owner,
                        created: args.now,
                    },
                });
                let pending_file: PendingFile = args.into();
                if pending_file.is_completed() {
                    Some(pending_file)
                } else {
                    e.insert(pending_file);
                    None
                }
            }
            Occupied(mut e) => {
                let pending_file = e.get_mut();
                match pending_file.add_chunk(args.chunk_index, args.bytes) {
                    AddChunkResult::Success => {}
                    AddChunkResult::ChunkIndexTooHigh => return PutChunkResult::ChunkIndexTooHigh,
                    AddChunkResult::ChunkAlreadyExists => return PutChunkResult::ChunkAlreadyExists,
                    AddChunkResult::ChunkSizeMismatch(m) => return PutChunkResult::ChunkSizeMismatch(m),
                }
                if pending_file.is_completed() {
                    Some(e.remove())
                } else {
                    None
                }
            }
        };

        let mut file_completed = false;
        if let Some(completed_file) = completed_file {
            let hash = hash_bytes(&completed_file.bytes);
            if hash != completed_file.hash {
                return PutChunkResult::HashMismatch(HashMismatch {
                    provided_hash: completed_file.hash,
                    actual_hash: hash,
                    chunk_count: completed_file.chunk_count(),
                    meta_data: FileMetaData {
                        owner: completed_file.owner,
                        created: completed_file.created,
                    },
                });
            }
            self.insert_completed_file(file_id, completed_file);
            file_completed = true;
        }

        PutChunkResult::Success(PutChunkResultSuccess {
            file_completed,
            file_added,
        })
    }

    pub fn remove(&mut self, caller: Principal, file_id: FileId) -> RemoveFileResult {
        if let Some(file) = self.get(&file_id) {
            if file.can_be_removed_by(caller) {
                let file_removed = self.remove_file(file_id).unwrap();

                RemoveFileResult::Success(file_removed)
            } else {
                RemoveFileResult::NotAuthorized
            }
        } else {
            RemoveFileResult::NotFound
        }
    }

    pub fn remove_unchecked(&mut self, file_id: FileId) -> RemoveFileResult {
        if let Some(file_removed) = self.remove_file(file_id) {
            RemoveFileResult::Success(file_removed)
        } else {
            RemoveFileResult::NotFound
        }
    }

    pub fn forward(
        &mut self,
        caller: Principal,
        file_id: FileId,
        canister_id: CanisterId,
        file_id_seed: u128,
        accessors: BTreeSet<AccessorId>,
        now: TimestampMillis,
    ) -> ForwardFileResult {
        let (file, size) = match self.file_and_size(&file_id) {
            Some((f, s)) => (f, s),
            None => return ForwardFileResult::NotFound,
        };

        let hash = file.hash;
        let new_file_id = generate_file_id(canister_id, caller, hash, file_id_seed, now);

        self.accessors_map.link(caller, new_file_id);
        for accessor in accessors.iter().copied() {
            self.accessors_map.link(accessor, new_file_id);
        }
        self.reference_counts.incr(hash);

        let meta_data = file.meta_data();
        let new_file = File {
            owner: caller,
            created: now,
            accessors,
            hash,
            mime_type: file.mime_type,
        };

        self.files.insert(new_file_id, new_file);

        ForwardFileResult::Success(FileAdded {
            file_id: new_file_id,
            hash,
            size,
            meta_data,
        })
    }

    pub fn remove_pending_file(&mut self, file_id: &FileId) -> bool {
        self.pending_files.remove(file_id).is_some()
    }

    pub fn remove_accessor(&mut self, accessor_id: &AccessorId) -> Vec<FileRemoved> {
        let mut files_removed = Vec::new();

        let file_ids = self.accessors_map.remove(*accessor_id);
        for file_id in file_ids {
            let mut blob_to_delete = None;
            if let Some(mut file) = self.get(&file_id) {
                file.accessors.remove(accessor_id);
                if file.accessors.is_empty() {
                    let delete_blob = self.reference_counts.decr(file.hash) == 0;
                    if delete_blob {
                        blob_to_delete = Some(file.hash);
                    }
                    if let Some(file_removed) = self.remove_file(file_id) {
                        files_removed.push(file_removed);
                    }
                } else {
                    self.files.insert(file_id, file);
                }
            }

            if let Some(blob_to_delete) = blob_to_delete {
                self.remove_blob(&blob_to_delete);
            }
        }

        files_removed
    }

    pub fn update_owner(&mut self, file_id: &FileId, new_owner: Principal) -> bool {
        if let Some(mut file) = self.get(file_id) {
            file.owner = new_owner;
            self.files.insert(*file_id, file);
            true
        } else {
            false
        }
    }

    pub fn update_accessor_id(&mut self, old_accessor_id: AccessorId, new_accessor_id: AccessorId) {
        let files = self.accessors_map.remove(old_accessor_id);
        for file_id in files.iter() {
            if let Some(mut file) = self.get(file_id) {
                if file.accessors.remove(&old_accessor_id) {
                    file.accessors.insert(new_accessor_id);
                    self.files.insert(*file_id, file);
                    self.accessors_map.link(new_accessor_id, *file_id);
                }
            }
        }
    }

    pub fn remove_expired_files(&mut self, now: TimestampMillis, max_count: usize) -> Vec<FileRemoved> {
        let mut files_removed = Vec::new();
        while let Some(file_id) = self
            .expiration_queue
            .first()
            .filter(|(ts, _)| *ts <= now)
            .is_some()
            .then(|| self.expiration_queue.pop_first().unwrap().1)
        {
            if let Some(file_removed) = self.remove_file(file_id) {
                files_removed.push(file_removed);
                if files_removed.len() >= max_count {
                    break;
                }
            }
        }
        files_removed
    }

    pub fn remove_old_pending_files(&mut self, cutoff: TimestampMillis) -> u32 {
        let old_count = self.pending_files.len();
        self.pending_files.retain(|_, f| f.created > cutoff);
        (old_count - self.pending_files.len()) as u32
    }

    pub fn next_expiry(&self) -> Option<TimestampMillis> {
        self.expiration_queue.first().map(|(ts, _)| *ts)
    }

    pub fn data_size(&self, hash: &Hash) -> Option<u64> {
        self.blobs.data_size(hash)
    }

    pub fn total_file_bytes(&self) -> u64 {
        self.total_file_bytes
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            file_count: self.files.len() as u64,
            blob_count: self.blobs.len(),
            pending_files: self.pending_files.len() as u64,
            total_file_bytes: self.total_file_bytes,
            expiration_queue_len: self.expiration_queue.len() as u64,
        }
    }

    fn insert_completed_file(&mut self, file_id: FileId, completed_file: PendingFile) {
        self.accessors_map.link(completed_file.owner, file_id);
        for accessor in completed_file.accessors.iter().copied() {
            self.accessors_map.link(accessor, file_id);
        }

        self.reference_counts.incr(completed_file.hash);
        self.add_blob_if_not_exists(completed_file.hash, completed_file.bytes);

        if let Some(expiry) = completed_file.expiry {
            self.expiration_queue.insert((expiry, file_id));
        }

        self.files.insert(
            file_id,
            File {
                owner: completed_file.owner,
                created: completed_file.created,
                accessors: completed_file.accessors,
                hash: completed_file.hash,
                mime_type: completed_file.mime_type,
            },
        );
    }

    fn remove_file(&mut self, file_id: FileId) -> Option<FileRemoved> {
        let file = self.files.remove(&file_id)?.into_value();

        if self.reference_counts.decr(file.hash) == 0 {
            self.remove_blob(&file.hash);
        }

        for accessor_id in file.accessors.iter() {
            self.accessors_map.unlink(*accessor_id, file_id);
        }

        Some(FileRemoved {
            file_id,
            meta_data: file.meta_data(),
        })
    }

    fn add_blob_if_not_exists(&mut self, hash: Hash, bytes: Vec<u8>) {
        if !self.blobs.exists(&hash) {
            self.total_file_bytes = self.total_file_bytes.saturating_add(bytes.len() as u64);

            self.blobs.insert(hash, bytes);
        }
    }

    fn remove_blob(&mut self, hash: &Hash) {
        if let Some(size) = self.blobs.data_size(hash) {
            self.blobs.remove(hash);
            self.total_file_bytes = self.total_file_bytes.saturating_sub(size);
        }
    }

    fn file_and_size(&self, file_id: &FileId) -> Option<(File, u64)> {
        let file = self.get(file_id)?;
        let size = self.blobs.get(&file.hash).map(|b| b.len() as u64)?;

        Some((file.clone(), size))
    }

    #[cfg(test)]
    pub fn new_with_blobs_memory(memory: crate::memory::Memory) -> Files {
        Files {
            blobs: StableBlobStorage::init_with_memory(memory),
            ..Default::default()
        }
    }

    #[cfg(test)]
    fn check_invariants(&self) {
        let files = self.files.get_all();

        assert!(!files.is_empty());
        assert_eq!(files.len(), self.files.len());

        let mut files_per_accessor: BTreeMap<AccessorId, Vec<FileId>> = BTreeMap::new();
        let mut reference_counts = BTreeMap::new();

        for (file_id, file) in files {
            for accessor in file.accessors.iter() {
                files_per_accessor.entry(*accessor).or_default().push(file_id);
            }
            *reference_counts.entry(file.hash).or_default() += 1;
        }

        assert_eq!(files_per_accessor, self.accessors_map.get_all());
        assert_eq!(reference_counts, self.reference_counts.get_all());
    }
}

#[derive(Serialize, Deserialize)]
pub struct PendingFile {
    #[serde(rename = "o", alias = "owner")]
    pub owner: Principal,
    #[serde(rename = "c", alias = "created")]
    pub created: TimestampMillis,
    #[serde(rename = "h", alias = "hash")]
    pub hash: Hash,
    #[serde(rename = "m", alias = "mime_type")]
    pub mime_type: String,
    #[serde(rename = "a", alias = "accessors")]
    pub accessors: BTreeSet<AccessorId>,
    #[serde(rename = "u", alias = "chunk_size")]
    pub chunk_size: u32,
    #[serde(rename = "t", alias = "total_size")]
    pub total_size: u64,
    #[serde(rename = "r", alias = "remaining_chunks")]
    pub remaining_chunks: BTreeSet<u32>,
    #[serde(rename = "b", alias = "bytes", with = "serde_bytes")]
    pub bytes: Vec<u8>,
    #[serde(rename = "e", alias = "expiry", skip_serializing_if = "Option::is_none")]
    pub expiry: Option<TimestampMillis>,
}

impl PendingFile {
    pub fn add_chunk(&mut self, chunk_index: u32, bytes: Vec<u8>) -> AddChunkResult {
        if self.remaining_chunks.remove(&chunk_index) {
            if let Some(expected_chunk_size) = self.expected_chunk_size(chunk_index) {
                let actual_chunk_size = bytes.len() as u32;
                if expected_chunk_size != actual_chunk_size {
                    return AddChunkResult::ChunkSizeMismatch(ChunkSizeMismatch {
                        expected_size: expected_chunk_size,
                        actual_size: actual_chunk_size,
                    });
                }
            } else {
                return AddChunkResult::ChunkIndexTooHigh;
            }

            let start_index = self.chunk_size as usize * chunk_index as usize;
            let end_index = start_index + bytes.len();
            self.bytes[start_index..end_index].copy_from_slice(&bytes);

            AddChunkResult::Success
        } else {
            AddChunkResult::ChunkAlreadyExists
        }
    }

    pub fn chunk_count(&self) -> u32 {
        calc_chunk_count(self.chunk_size, self.total_size)
    }

    pub fn is_completed(&self) -> bool {
        self.remaining_chunks.is_empty()
    }

    fn expected_chunk_size(&self, chunk_index: u32) -> Option<u32> {
        let last_index = self.chunk_count() - 1;
        match chunk_index.cmp(&last_index) {
            Ordering::Equal => Some(((self.total_size - 1) % self.chunk_size as u64) as u32 + 1),
            Ordering::Less => Some(self.chunk_size),
            Ordering::Greater => None,
        }
    }
}

pub enum AddChunkResult {
    Success,
    ChunkAlreadyExists,
    ChunkIndexTooHigh,
    ChunkSizeMismatch(ChunkSizeMismatch),
}

pub struct PutChunkArgs {
    owner: Principal,
    file_id: FileId,
    hash: Hash,
    mime_type: String,
    accessors: Vec<AccessorId>,
    chunk_index: u32,
    chunk_size: u32,
    total_size: u64,
    bytes: Vec<u8>,
    expiry: Option<TimestampMillis>,
    now: TimestampMillis,
}

impl PutChunkArgs {
    pub fn new(owner: Principal, upload_chunk_args: UploadChunkArgs, now: TimestampMillis) -> Self {
        Self {
            owner,
            file_id: upload_chunk_args.file_id,
            hash: upload_chunk_args.hash,
            mime_type: upload_chunk_args.mime_type,
            accessors: upload_chunk_args.accessors,
            chunk_index: upload_chunk_args.chunk_index,
            chunk_size: upload_chunk_args.chunk_size,
            total_size: upload_chunk_args.total_size,
            bytes: upload_chunk_args.bytes,
            expiry: upload_chunk_args.expiry,
            now,
        }
    }
}

impl From<PutChunkArgs> for PendingFile {
    fn from(args: PutChunkArgs) -> Self {
        let chunk_count = calc_chunk_count(args.chunk_size, args.total_size);

        let mut pending_file = Self {
            owner: args.owner,
            created: args.now,
            hash: args.hash,
            mime_type: args.mime_type,
            accessors: args.accessors.into_iter().collect(),
            chunk_size: args.chunk_size,
            total_size: args.total_size,
            remaining_chunks: (0..chunk_count).collect(),
            bytes: vec![0; args.total_size as usize],
            expiry: args.expiry,
        };
        pending_file.add_chunk(args.chunk_index, args.bytes);
        pending_file
    }
}

#[allow(dead_code)]
pub enum PutChunkResult {
    Success(PutChunkResultSuccess),
    FileAlreadyExists,
    FileTooBig(u64),
    FileExpired,
    ChunkAlreadyExists,
    ChunkIndexTooHigh,
    ChunkSizeMismatch(ChunkSizeMismatch),
    HashMismatch(HashMismatch),
}

pub struct PutChunkResultSuccess {
    pub file_completed: bool,
    pub file_added: Option<FileAdded>,
}

pub enum RemoveFileResult {
    Success(FileRemoved),
    NotAuthorized,
    NotFound,
}

pub enum ForwardFileResult {
    Success(FileAdded),
    NotFound,
}

#[allow(dead_code)]
pub struct HashMismatch {
    pub provided_hash: Hash,
    pub actual_hash: Hash,
    pub chunk_count: u32,
    pub meta_data: FileMetaData,
}

#[allow(dead_code)]
pub struct ChunkSizeMismatch {
    pub expected_size: u32,
    pub actual_size: u32,
}

pub struct Metrics {
    pub file_count: u64,
    pub blob_count: u64,
    pub pending_files: u64,
    pub total_file_bytes: u64,
    pub expiration_queue_len: u64,
}
