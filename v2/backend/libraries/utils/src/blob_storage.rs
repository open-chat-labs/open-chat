use candid::CandidType;
use serde::Deserialize;
use serde_bytes::ByteBuf;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::TimestampMillis;

const MAX_CHUNK_SIZE: u64 = 1024 * 1024; // 1MB

#[derive(Default, CandidType, Deserialize)]
pub struct BlobStorage {
    blobs: HashMap<u128, Blob>,
    pending_blobs: HashMap<u128, PendingBlob>,
    orphan_chunks: HashMap<u128, Vec<(u32, ByteBuf)>>,
    total_bytes: u64,
    max_bytes: u64,
}

#[derive(Default, CandidType, Deserialize)]
pub struct Blob {
    created: TimestampMillis,
    mime_type: String,
    chunks: Vec<ByteBuf>,
}

#[derive(Default, CandidType, Deserialize)]
pub struct PendingBlob {
    created: TimestampMillis,
    chunks_remaining: u32,
    mime_type: String,
    chunks: Vec<ByteBuf>,
}

pub enum PutChunkResult {
    Success,
    ChunkAlreadyExists,
    ChunkTooBig,
    Full,
}

impl PendingBlob {
    pub fn new(now: TimestampMillis, mime_type: String, total_chunks: u32) -> PendingBlob {
        PendingBlob {
            created: now,
            mime_type,
            chunks_remaining: total_chunks,
            chunks: Vec::with_capacity(total_chunks as usize),
        }
    }

    pub fn add_chunk(&mut self, index: u32, data: ByteBuf) {
        self.chunks[index as usize] = data;
        self.chunks_remaining -= 1;
    }

    pub fn is_complete(&self) -> bool {
        self.chunks_remaining == 0
    }
}

impl Blob {
    pub fn from(pending_blob: PendingBlob, now: TimestampMillis) -> Self {
        if !pending_blob.is_complete() {
            panic!("Pending blob is still incomplete");
        }

        Blob {
            created: now,
            mime_type: pending_blob.mime_type,
            chunks: pending_blob.chunks,
        }
    }

    pub fn mime_type(&self) -> &str {
        &self.mime_type
    }

    pub fn chunk(&self, index: u32) -> Option<&ByteBuf> {
        self.chunks.get(index as usize)
    }
}

impl BlobStorage {
    pub fn new(max_bytes: u64) -> BlobStorage {
        BlobStorage {
            blobs: HashMap::default(),
            pending_blobs: HashMap::default(),
            orphan_chunks: HashMap::default(),
            total_bytes: 0,
            max_bytes,
        }
    }

    pub fn get_blob(&self, blob_id: &u128) -> Option<&Blob> {
        self.blobs.get(blob_id)
    }

    pub fn put_first_chunk(
        &mut self,
        blob_id: u128,
        mime_type: String,
        total_chunks: u32,
        data: ByteBuf,
        now: TimestampMillis,
    ) -> PutChunkResult {
        if self.blobs.contains_key(&blob_id) {
            return PutChunkResult::ChunkAlreadyExists;
        }

        let byte_count = data.len() as u64;

        if byte_count > MAX_CHUNK_SIZE {
            return PutChunkResult::ChunkTooBig;
        }

        if (self.total_bytes + byte_count) > self.max_bytes {
            return PutChunkResult::Full;
        }

        match self.pending_blobs.entry(blob_id) {
            Vacant(e) => {
                let mut pending_blob = PendingBlob::new(now, mime_type, total_chunks);
                pending_blob.add_chunk(0, data);

                if let Some(existing_chunks) = self.orphan_chunks.remove(&blob_id) {
                    for (index, chunk) in existing_chunks.into_iter() {
                        pending_blob.add_chunk(index, chunk);
                    }
                }

                if pending_blob.is_complete() {
                    self.blobs.insert(blob_id, Blob::from(pending_blob, now));
                } else {
                    e.insert(pending_blob);
                }
                self.total_bytes += byte_count;
                PutChunkResult::Success
            }
            Occupied(_) => PutChunkResult::ChunkAlreadyExists,
        }
    }

    pub fn put_chunk(&mut self, blob_id: u128, chunk_index: u32, data: ByteBuf, now: TimestampMillis) -> PutChunkResult {
        if chunk_index == 0 {
            panic!("Must call 'put_first_chunk' when chunk_index is 0");
        }

        if self.blobs.contains_key(&blob_id) {
            return PutChunkResult::ChunkAlreadyExists;
        }

        let byte_count = data.len() as u64;

        if byte_count > MAX_CHUNK_SIZE {
            return PutChunkResult::ChunkTooBig;
        }

        if (self.total_bytes + byte_count) > self.max_bytes {
            return PutChunkResult::Full;
        }

        if let Occupied(mut e) = self.pending_blobs.entry(blob_id) {
            let pending_blob = e.get_mut();
            pending_blob.add_chunk(chunk_index, data);
            if pending_blob.is_complete() {
                let blob = Blob::from(e.remove(), now);
                self.blobs.insert(blob_id, blob);
            }
        }

        self.total_bytes += byte_count;
        PutChunkResult::Success
    }

    pub fn get_chunk(&self, blob_id: u128, chunk_index: u32) -> Option<&ByteBuf> {
        self.blobs.get(&blob_id).map(|b| b.chunks.get(chunk_index as usize)).flatten()
    }

    pub fn exists(&self, blob_id: u128, chunk_index: u32) -> bool {
        self.blobs
            .get(&blob_id)
            .map_or(false, |b| b.chunks.len() as u32 > chunk_index)
    }

    pub fn delete_blob(&mut self, blob_id: u128) -> bool {
        if let Some(bytes_removed) = self
            .blobs
            .remove(&blob_id)
            .map(|b| count_bytes(b.chunks.iter()))
            .or_else(|| self.pending_blobs.remove(&blob_id).map(|b| count_bytes(b.chunks.iter())))
            .or_else(|| {
                self.orphan_chunks
                    .remove(&blob_id)
                    .map(|b| count_bytes(b.iter().map(|(_, chunk)| chunk)))
            })
        {
            self.total_bytes -= bytes_removed;
            true
        } else {
            false
        }
    }

    pub fn get_blob_count(&self) -> u32 {
        self.blobs.len() as u32
    }

    pub fn get_total_bytes(&self) -> u64 {
        self.total_bytes
    }
}

fn count_bytes<'a>(chunks: impl Iterator<Item = &'a ByteBuf>) -> u64 {
    chunks.map(|c| c.len()).sum::<usize>() as u64
}
