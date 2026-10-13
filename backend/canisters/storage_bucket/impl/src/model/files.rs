use crate::model::files_map::FilesMap;
use crate::model::files_per_accessor_map::FilesPerAccessorStableMap;
use crate::model::reference_counts::ReferenceCountsStableMap;
use crate::model::stable_blob_storage::StableBlobStorage;
use crate::{MAX_BLOB_SIZE_BYTES, calc_chunk_count};
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::cmp::Ordering;
use std::collections::btree_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use storage_bucket_canister::upload_chunk_v2::Args as UploadChunkArgs;
use types::{AccessorId, CanisterId, FileAdded, FileId, FileMetaData, FileRemoved, Hash, TimestampMillis, UserId};
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
    // Hashes pinned by the evidence vault. A pin holds one reference so that no deletion path
    // can remove the blob while it is quarantined (see model::vault).
    #[serde(default)]
    vault_pins: BTreeSet<Hash>,
    // Stored hash -> hashes clients DECLARED they transcoded to produce it (see
    // upload_chunk_v2::Args::source_hash). Claims, not facts - the bucket never sees the source
    // bytes - so a verdict on the stored hash denylists these only as derived (uploads refused,
    // nobody sanctioned), and an upload declaring one of them is refused the same way while the
    // stored hash is vault-pinned. Dropped with the blob unless it is vault-pinned (a later
    // copy of the same bytes re-declares its own source), so this cannot grow past the blobs.
    #[serde(default)]
    source_hashes: BTreeMap<Hash, BTreeSet<Hash>>,
    // Accessors to be removed from the files naming them, oldest first. Each is a deleted group or
    // community, which the files sent in it name as their only accessor, so those files are removed.
    #[serde(default)]
    accessor_removals: VecDeque<AccessorId>,
    // The number of files removed through their last accessor being removed
    #[serde(default)]
    accessor_removal_files_removed: u64,
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
    // An accessor which is the id of a user sharing a canister with others is held by that canister
    pub fn can_be_removed_by(&self, principal: Principal) -> bool {
        // TODO accessors should have roles rather than always being allowed to remove files
        self.owner == principal || self.accessors.iter().any(|a| UserId::from(*a).canister_id() == principal)
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

    // The owner and created time of the file, if it's held, either complete or still being uploaded
    #[cfg(test)]
    pub fn owner_and_created(&self, file_id: &FileId) -> Option<(Principal, TimestampMillis)> {
        self.get(file_id)
            .map(|f| (f.owner, f.created))
            .or_else(|| self.pending_files.get(file_id).map(|f| (f.owner, f.created)))
    }

    pub fn pending_file(&self, file_id: &FileId) -> Option<&PendingFile> {
        self.pending_files.get(file_id)
    }

    // Bytes in the range [start, end), reading only the stable memory chunks which overlap it
    pub fn blob_range(&self, hash: &Hash, start: usize, end: usize) -> Vec<u8> {
        self.blobs.get_range(hash, start, end)
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
            let file_removed = self.pending_files.remove(&args.file_id).map(|f| f.removed(args.file_id));
            return PutChunkResult::FileExpired(file_removed);
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
                if pending_file.is_completed() { Some(e.remove()) } else { None }
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

        let new_file = File {
            owner: caller,
            created: now,
            accessors,
            hash,
            mime_type: file.mime_type,
        };
        // Reported as the forwarder's, as it will be once removed, since the index keys files by
        // their owner and created time
        let meta_data = new_file.meta_data();

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

    pub fn queue_accessor_removals(&mut self, accessor_ids: impl IntoIterator<Item = AccessorId>) {
        self.accessor_removals.extend(accessor_ids);
    }

    pub fn accessor_removals_queued(&self) -> bool {
        !self.accessor_removals.is_empty()
    }

    // Removes the queued accessors, oldest first, from the files linked to them, in steps of at most
    // `max_files_per_step` files, until `keep_going` returns false after a step or none are left.
    // Each accessor is removed from the queue once no more files are linked to it. The files left
    // with other accessors are written back together once it stops, so that each node of the stable
    // memory map is written once rather than once per file. Returns the files removed.
    pub fn remove_queued_accessors_while(
        &mut self,
        max_files_per_step: usize,
        mut keep_going: impl FnMut() -> bool,
    ) -> Vec<FileRemoved> {
        let mut files_removed = Vec::new();
        let mut files_updated = BTreeMap::new();
        while let Some(accessor_id) = self.accessor_removals.front().copied() {
            let (removed, complete) = self.remove_accessor(&accessor_id, max_files_per_step, &mut files_updated);
            if complete {
                self.accessor_removals.pop_front();
            }
            self.accessor_removal_files_removed += removed.len() as u64;
            files_removed.extend(removed);
            if !keep_going() {
                break;
            }
        }
        self.files.update_many(files_updated);
        files_removed
    }

    // Removes the accessor from at most `max_files` of the files linked to it, removing each file
    // it was the last accessor of. The files left with other accessors are put in `files_updated`,
    // to be written back by the caller, and are read from there rather than from stable memory.
    // Returns the files removed, and whether no more files are linked to it.
    fn remove_accessor(
        &mut self,
        accessor_id: &AccessorId,
        max_files: usize,
        files_updated: &mut BTreeMap<FileId, File>,
    ) -> (Vec<FileRemoved>, bool) {
        let mut files_removed = Vec::new();

        let file_ids = self.accessors_map.remove(*accessor_id, max_files);
        let complete = file_ids.len() < max_files;
        for file_id in file_ids {
            let Some(mut file) = files_updated.remove(&file_id).or_else(|| self.files.get(&file_id)) else {
                continue;
            };
            file.accessors.remove(accessor_id);
            // The file is kept if it still has other accessors, otherwise it is removed
            if !file.accessors.is_empty() {
                files_updated.insert(file_id, file);
            } else if let Some(file_removed) = self.remove_file(file_id) {
                // `remove_file` releases the file's reference to the blob (and the blob itself
                // when that was the last one); decrementing here as well would drop a
                // reference held by another file or by a vault pin
                files_removed.push(file_removed);
            }
        }

        (files_removed, complete)
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

    pub fn remove_old_pending_files(&mut self, cutoff: TimestampMillis) -> Vec<FileRemoved> {
        let old: Vec<_> = self
            .pending_files
            .iter()
            .filter(|(_, f)| f.created <= cutoff)
            .map(|(file_id, _)| *file_id)
            .collect();

        old.into_iter()
            .filter_map(|file_id| self.pending_files.remove(&file_id).map(|f| f.removed(file_id)))
            .collect()
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
            source_hashes: self.source_hashes.len() as u64,
            accessor_removals_queued: self.accessor_removals.len() as u64,
            accessor_removal_files_removed: self.accessor_removal_files_removed,
        }
    }

    fn insert_completed_file(&mut self, file_id: FileId, completed_file: PendingFile) {
        self.accessors_map.link(completed_file.owner, file_id);
        for accessor in completed_file.accessors.iter().copied() {
            self.accessors_map.link(accessor, file_id);
        }

        self.reference_counts.incr(completed_file.hash);
        self.add_blob_if_not_exists(completed_file.hash, completed_file.bytes);
        if let Some(source_hash) = completed_file.source_hash.filter(|s| *s != completed_file.hash) {
            self.source_hashes.entry(completed_file.hash).or_default().insert(source_hash);
        }

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

        // The owner is linked as well as the accessors (see `insert_completed_file` and `forward`)
        self.accessors_map.unlink(file.owner, file_id);
        for accessor_id in file.accessors.iter().filter(|a| **a != file.owner) {
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

    // Takes a vault pin on the hash of the given file, incrementing the reference count so the
    // blob survives every existing deletion path. Returns the hash and mime type, or None if
    // the file is gone.
    pub fn vault_pin(&mut self, file_id: &FileId) -> Option<(Hash, String)> {
        let file = self.get(file_id)?;
        if self.vault_pins.insert(file.hash) {
            self.reference_counts.incr(file.hash);
        }
        Some((file.hash, file.mime_type))
    }

    // Releases a vault pin, removing the blob if the pin held the last reference
    pub fn vault_unpin(&mut self, hash: &Hash) {
        if self.vault_pins.remove(hash) && self.reference_counts.decr(*hash) == 0 {
            self.remove_blob(hash);
        }
    }

    // Releases a vault pin AND removes the blob bytes regardless of remaining file references:
    // at retention expiry or LE-requested destruction, a restored or re-posted message still
    // referencing the same bytes must not resurrect public serving of the content
    pub fn vault_purge(&mut self, hash: &Hash) {
        if self.vault_pins.remove(hash) {
            self.reference_counts.decr(*hash);
        }
        self.remove_blob(hash);
    }

    pub fn is_vault_pinned(&self, hash: &Hash) -> bool {
        self.vault_pins.contains(hash)
    }

    // The vault-pinned hash some client declared was transcoded from the given source, if any.
    // Pins are few (one per quarantined blob), so scanning them is cheaper than a reverse map.
    pub fn vault_pinned_hash_for_source(&self, source_hash: &Hash) -> Option<Hash> {
        self.vault_pins
            .iter()
            .find(|pinned| self.source_hashes.get(*pinned).is_some_and(|s| s.contains(source_hash)))
            .copied()
    }

    pub fn source_hashes(&self, hash: &Hash) -> Vec<Hash> {
        self.source_hashes
            .get(hash)
            .map(|s| s.iter().copied().collect())
            .unwrap_or_default()
    }

    fn remove_blob(&mut self, hash: &Hash) {
        if let Some(size) = self.blobs.data_size(hash) {
            self.blobs.remove(hash);
            self.total_file_bytes = self.total_file_bytes.saturating_sub(size);
        }
        if !self.vault_pins.contains(hash) {
            self.source_hashes.remove(hash);
        }
    }

    fn file_and_size(&self, file_id: &FileId) -> Option<(File, u64)> {
        let file = self.get(file_id)?;
        let size = self.blobs.data_size(&file.hash)?;

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

        // Each file's accessors must be linked to it. So must its owner, unless the owner was removed
        // as an accessor and the file lived on through its other accessors, which drops the owner's
        // link. Nothing else may be linked.
        let mut required_links = BTreeSet::new();
        let mut owner_links = BTreeSet::new();
        let mut reference_counts = BTreeMap::new();

        for (file_id, file) in files {
            for accessor in file.accessors.iter() {
                required_links.insert((*accessor, file_id));
            }
            owner_links.insert((file.owner, file_id));
            *reference_counts.entry(file.hash).or_default() += 1;
        }

        for hash in self.vault_pins.iter() {
            *reference_counts.entry(*hash).or_default() += 1;
        }

        let links: BTreeSet<(AccessorId, FileId)> = self
            .accessors_map
            .get_all()
            .into_iter()
            .flat_map(|(accessor, file_ids)| file_ids.into_iter().map(move |file_id| (accessor, file_id)))
            .collect();

        assert!(required_links.is_subset(&links));
        assert!(links.difference(&required_links).all(|link| owner_links.contains(link)));
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
    #[serde(rename = "s", default, skip_serializing_if = "Option::is_none")]
    pub source_hash: Option<Hash>,
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

    // The index is told of an upload once its first chunk arrives, so must be told when an upload
    // is removed before completing
    pub fn removed(&self, file_id: FileId) -> FileRemoved {
        FileRemoved {
            file_id,
            meta_data: FileMetaData {
                owner: self.owner,
                created: self.created,
            },
        }
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
    source_hash: Option<Hash>,
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
            source_hash: upload_chunk_args.source_hash,
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
            source_hash: args.source_hash,
        };
        pending_file.add_chunk(args.chunk_index, args.bytes);
        pending_file
    }
}

#[expect(dead_code)]
pub enum PutChunkResult {
    Success(PutChunkResultSuccess),
    FileAlreadyExists,
    FileTooBig(u64),
    // With the upload in progress which it removed, if there was one
    FileExpired(Option<FileRemoved>),
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

#[expect(dead_code)]
pub struct HashMismatch {
    pub provided_hash: Hash,
    pub actual_hash: Hash,
    pub chunk_count: u32,
    pub meta_data: FileMetaData,
}

#[expect(dead_code)]
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
    pub source_hashes: u64,
    pub accessor_removals_queued: u64,
    pub accessor_removal_files_removed: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    fn files() -> Files {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(2)));
        Files::new_with_blobs_memory(memory.get(MemoryId::new(1)))
    }

    fn put(files: &mut Files, file_id: FileId, bytes: Vec<u8>, source_hash: Option<Hash>) -> Hash {
        let owner = Principal::from_slice(&[1]);
        put_as(files, owner, vec![owner], file_id, bytes, source_hash)
    }

    fn put_as(
        files: &mut Files,
        owner: Principal,
        accessors: Vec<AccessorId>,
        file_id: FileId,
        bytes: Vec<u8>,
        source_hash: Option<Hash>,
    ) -> Hash {
        let hash = hash_bytes(&bytes);
        let result = files.put_chunk(PutChunkArgs {
            owner,
            file_id,
            hash,
            mime_type: "video/mp4".to_string(),
            accessors,
            chunk_index: 0,
            chunk_size: bytes.len() as u32,
            total_size: bytes.len() as u64,
            bytes,
            expiry: None,
            source_hash,
            now: 1000,
        });
        assert!(matches!(result, PutChunkResult::Success(_)));
        hash
    }

    #[test]
    fn source_hash_is_recorded_against_the_stored_hash_and_goes_with_the_blob() {
        let mut files = files();
        let source = hash_bytes(b"the original phone recording");
        let hash = put(&mut files, 1, b"transcoded".to_vec(), Some(source));
        assert_eq!(files.source_hashes(&hash), vec![source]);

        // A source equal to the stored hash (uploaded as-is) is not a transcode
        let bytes = b"uploaded as-is".to_vec();
        let same = put(&mut files, 2, bytes.clone(), Some(hash_bytes(&bytes)));
        assert!(files.source_hashes(&same).is_empty());

        // Last reference gone: the blob goes and so does the claim
        files.remove_file(1);
        assert!(files.get(&1).is_none());
        assert!(files.source_hashes(&hash).is_empty());
    }

    #[test]
    fn vault_pin_is_found_by_source_hash_for_as_long_as_the_pin_holds() {
        let mut files = files();
        let source = hash_bytes(b"the original phone recording");
        let hash = put(&mut files, 1, b"transcoded".to_vec(), Some(source));
        put(&mut files, 2, b"unrelated".to_vec(), None);

        assert_eq!(files.vault_pinned_hash_for_source(&source), None);
        assert_eq!(files.vault_pin(&1).map(|(h, _)| h), Some(hash));
        assert_eq!(files.vault_pinned_hash_for_source(&source), Some(hash));
        assert_eq!(files.vault_pinned_hash_for_source(&hash), None);

        // The file record can be deleted while quarantined; the pin keeps the blob and its sources
        files.remove_file(1);
        assert_eq!(files.vault_pinned_hash_for_source(&source), Some(hash));

        // Releasing the pin ends the pre-verdict refusal, and the last reference takes the claims
        files.vault_unpin(&hash);
        assert_eq!(files.vault_pinned_hash_for_source(&source), None);
        assert!(files.source_hashes(&hash).is_empty());
    }

    #[test]
    fn removing_an_accessor_releases_one_reference_only() {
        let mut files = files();
        let hash = put(&mut files, 1, b"pinned".to_vec(), None);
        assert_eq!(files.vault_pin(&1).map(|(h, _)| h), Some(hash));

        // File reference released, the pin's reference must survive it
        files.queue_accessor_removals([Principal::from_slice(&[1])]);
        let removed = files.remove_queued_accessors_while(10, || true);
        assert_eq!(removed.len(), 1);
        assert!(files.get(&1).is_none());
        assert!(files.blobs.exists(&hash));

        files.vault_unpin(&hash);
        assert!(!files.blobs.exists(&hash));
    }

    #[test]
    fn removing_an_accessor_leaves_the_files_of_accessors_sorting_after_it_alone() {
        let mut files = files();
        let accessor = Principal::from_slice(&[1]);
        let owner = Principal::from_slice(&[1, 1]);
        let other_owner = Principal::from_slice(&[2]);

        put_as(&mut files, owner, vec![accessor], 1, b"shared".to_vec(), None);
        // Linked only through their owners, both of whose keys sort after the accessor's
        put_as(&mut files, owner, Vec::new(), 2, b"private".to_vec(), None);
        put_as(&mut files, other_owner, Vec::new(), 3, b"other".to_vec(), None);

        files.queue_accessor_removals([accessor]);
        let removed = files.remove_queued_accessors_while(10, || true);
        assert_eq!(removed.iter().map(|f| f.file_id).collect::<Vec<_>>(), vec![1]);
        assert!(files.get(&2).is_some());
        assert!(files.get(&3).is_some());
        assert_eq!(files.accessors_map.get(owner), vec![2]);
        assert_eq!(files.accessors_map.get(other_owner), vec![3]);
    }

    #[test]
    fn a_queued_accessor_is_removed_a_few_files_at_a_time() {
        let mut files = files();
        let owner = Principal::from_slice(&[1]);
        let group = canister(2);
        let other_group = canister(3);
        let user = canister(4);

        put_as(&mut files, owner, vec![group], 1, b"one".to_vec(), None);
        put_as(&mut files, owner, vec![group], 2, b"two".to_vec(), None);
        // Named by another accessor too, so it lives on through that one
        put_as(&mut files, owner, vec![group, user], 3, b"three".to_vec(), None);
        put_as(&mut files, owner, vec![other_group], 4, b"four".to_vec(), None);

        // Two files at a time, so the removal stays queued until no more files are linked to it
        files.queue_accessor_removals([group]);
        let mut removed = Vec::new();
        while files.accessor_removals_queued() {
            removed.extend(
                files
                    .remove_queued_accessors_while(2, || false)
                    .into_iter()
                    .map(|f| f.file_id),
            );
        }
        files.check_invariants();

        assert_eq!(removed, vec![1, 2]);
        assert!(!files.accessor_removals_queued());
        assert_eq!(files.metrics().accessor_removal_files_removed, 2);
        assert!(files.get(&1).is_none());
        assert!(files.get(&2).is_none());
        assert_eq!(files.get(&3).unwrap().accessors, BTreeSet::from([user]));
        assert!(files.get(&4).is_some());
        assert!(files.accessors_map.get(group).is_empty());
    }

    // The files updated by each step are written back together once the steps stop, so a later step
    // must see those written back by an earlier one
    #[test]
    fn accessors_removed_in_steps_written_back_together_match_those_written_back_each_step() {
        let owner = Principal::from_slice(&[1]);
        let [group, other_group, user] = [2, 3, 4].map(canister);
        let setup = |files: &mut Files| {
            put_as(files, owner, vec![group, other_group, user], 1, b"one".to_vec(), None);
            put_as(files, owner, vec![group, other_group], 2, b"two".to_vec(), None);
            put_as(files, owner, vec![other_group, user], 3, b"three".to_vec(), None);
            put_as(files, owner, vec![group], 4, b"four".to_vec(), None);
            put_as(files, owner, vec![user], 5, b"five".to_vec(), None);
            files.queue_accessor_removals([group, other_group]);
        };

        let mut each_step = files();
        setup(&mut each_step);
        let mut removed_each_step = Vec::new();
        while each_step.accessor_removals_queued() {
            removed_each_step.extend(each_step.remove_queued_accessors_while(1, || false));
        }
        let expected = (
            each_step.files.get_all(),
            each_step.accessors_map.get_all(),
            each_step.metrics(),
        );

        let mut together = files();
        setup(&mut together);
        let removed_together = together.remove_queued_accessors_while(1, || true);
        together.check_invariants();

        let file_ids = |removed: Vec<FileRemoved>| removed.into_iter().map(|f| f.file_id).collect::<Vec<_>>();
        assert_eq!(file_ids(removed_together), file_ids(removed_each_step));
        let files_left: Vec<_> = together
            .files
            .get_all()
            .into_iter()
            .map(|(id, f)| (id, f.accessors))
            .collect();
        assert_eq!(
            files_left,
            expected.0.into_iter().map(|(id, f)| (id, f.accessors)).collect::<Vec<_>>()
        );
        assert_eq!(
            files_left,
            vec![
                (1, BTreeSet::from([user])),
                (3, BTreeSet::from([user])),
                (5, BTreeSet::from([user]))
            ]
        );
        assert_eq!(together.accessors_map.get_all(), expected.1);
        assert_eq!(together.metrics().file_count, expected.2.file_count);
        assert_eq!(together.metrics().accessor_removal_files_removed, 2);
        assert!(!together.accessor_removals_queued());
    }

    #[test]
    fn removing_a_file_unlinks_its_owner_as_well_as_its_accessors() {
        let mut files = files();
        let owner = Principal::from_slice(&[1]);
        let accessor = Principal::from_slice(&[2]);

        put_as(&mut files, owner, vec![accessor], 1, b"bytes".to_vec(), None);
        assert_eq!(files.accessors_map.get(owner), vec![1]);
        assert_eq!(files.accessors_map.get(accessor), vec![1]);

        files.remove_file(1);
        assert!(files.accessors_map.get(owner).is_empty());
        assert!(files.accessors_map.get(accessor).is_empty());
    }

    fn canister(i: u8) -> CanisterId {
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
    }

    // A direct message's files name the users in it as accessors, so the MultiUser canister holding
    // one of them may remove them
    #[test]
    fn the_canister_holding_an_accessor_can_remove_its_files() {
        let mut files = files();
        let owner = Principal::from_slice(&[1]);
        let multi_user_canister = canister(2);
        let user_id = UserId::new_indexed(multi_user_canister, 3);

        put_as(&mut files, owner, vec![user_id.as_principal()], 1, b"one".to_vec(), None);

        assert!(matches!(files.remove(canister(4), 1), RemoveFileResult::NotAuthorized));
        assert!(matches!(files.remove(multi_user_canister, 1), RemoveFileResult::Success(_)));
    }

    #[test]
    fn a_forwarded_file_is_reported_as_the_forwarders_both_when_added_and_when_removed() {
        let mut files = files();
        put(&mut files, 1, b"bytes".to_vec(), None);
        let forwarder = Principal::from_slice(&[2]);

        let ForwardFileResult::Success(added) =
            files.forward(forwarder, 1, CanisterId::from_slice(&[3]), 0, BTreeSet::new(), 2000)
        else {
            panic!("Forward failed");
        };
        assert_eq!(added.meta_data.owner, forwarder);
        assert_eq!(added.meta_data.created, 2000);
        assert_eq!(files.owner_and_created(&added.file_id), Some((forwarder, 2000)));

        // The index finds the file it is removing by its owner and created time
        let removed = files.remove_file(added.file_id).unwrap();
        assert_eq!(removed.meta_data.owner, added.meta_data.owner);
        assert_eq!(removed.meta_data.created, added.meta_data.created);
    }

    // The first of two chunks
    fn put_first_chunk(
        files: &mut Files,
        file_id: FileId,
        now: TimestampMillis,
        expiry: Option<TimestampMillis>,
    ) -> PutChunkResult {
        files.put_chunk(PutChunkArgs {
            owner: Principal::from_slice(&[1]),
            file_id,
            hash: [1; 32],
            mime_type: "video/mp4".to_string(),
            accessors: Vec::new(),
            chunk_index: 0,
            chunk_size: 1,
            total_size: 2,
            bytes: vec![0],
            expiry,
            source_hash: None,
            now,
        })
    }

    #[test]
    fn uploads_removed_before_completing_are_returned_to_be_reported_to_the_index() {
        let mut files = files();
        assert!(matches!(
            put_first_chunk(&mut files, 1, 1000, None),
            PutChunkResult::Success(_)
        ));
        assert!(matches!(
            put_first_chunk(&mut files, 2, 5000, None),
            PutChunkResult::Success(_)
        ));
        assert!(matches!(
            put_first_chunk(&mut files, 3, 1000, Some(10_000)),
            PutChunkResult::Success(_)
        ));

        // Abandoned uploads
        let removed = files.remove_old_pending_files(2000);
        let removed: Vec<_> = removed.iter().map(|f| (f.file_id, f.meta_data.created)).collect();
        assert_eq!(removed, vec![(1, 1000), (3, 1000)]);
        assert!(files.owner_and_created(&1).is_none());
        assert_eq!(files.owner_and_created(&2), Some((Principal::from_slice(&[1]), 5000)));

        // An upload which has expired by the time its next chunk arrives
        assert!(matches!(
            put_first_chunk(&mut files, 4, 1000, Some(10_000)),
            PutChunkResult::Success(_)
        ));
        let PutChunkResult::FileExpired(Some(removed)) = put_first_chunk(&mut files, 4, 20_000, Some(10_000)) else {
            panic!("Expected the upload to be removed as expired");
        };
        assert_eq!(
            (removed.file_id, removed.meta_data.owner, removed.meta_data.created),
            (4, Principal::from_slice(&[1]), 1000)
        );
        assert!(files.owner_and_created(&4).is_none());
    }
}
