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
    meta: Option<Meta>,
    chunks: HashMap<u32, ByteBuf>,
}

#[derive(Default, CandidType, Deserialize)]
pub struct Meta {
    total_chunks: u32,
    mime_type: String,
}

pub enum PutChunkResult {
    Success,
    BlobAlreadyExists,
    ChunkAlreadyExists,
    ChunkTooBig,
    Full,
}

impl PendingBlob {
    pub fn new(now: TimestampMillis) -> PendingBlob {
        PendingBlob {
            created: now,
            meta: None,
            chunks: HashMap::default(),
        }
    }

    pub fn add_chunk(&mut self, index: u32, data: ByteBuf) -> bool {
        match self.chunks.entry(index) {
            Vacant(e) => {
                e.insert(data);
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn is_complete(&self) -> bool {
        if let Some(meta) = &self.meta {
            meta.total_chunks == self.chunks.len() as u32
        } else {
            false
        }
    }
}

impl Blob {
    pub fn from(pending_blob: PendingBlob, now: TimestampMillis) -> Self {
        if !pending_blob.is_complete() {
            panic!("Pending blob is still incomplete");
        }

        let meta = pending_blob.meta.unwrap();

        let mut chunks = vec![ByteBuf::default(); meta.total_chunks as usize];
        for (index, chunk) in pending_blob.chunks.into_iter() {
            chunks[index as usize] = chunk;
        }

        Blob {
            created: now,
            mime_type: meta.mime_type,
            chunks,
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
        self.put_chunk_internal(blob_id, Some(Meta { mime_type, total_chunks }), data, 0, now)
    }

    pub fn put_chunk(&mut self, blob_id: u128, chunk_index: u32, data: ByteBuf, now: TimestampMillis) -> PutChunkResult {
        if chunk_index == 0 {
            panic!("Must call 'put_first_chunk' when chunk_index is 0");
        }

        self.put_chunk_internal(blob_id, None, data, chunk_index, now)
    }

    fn put_chunk_internal(
        &mut self,
        blob_id: u128,
        meta: Option<Meta>,
        data: ByteBuf,
        chunk_index: u32,
        now: TimestampMillis,
    ) -> PutChunkResult {
        if self.blobs.contains_key(&blob_id) {
            return PutChunkResult::BlobAlreadyExists;
        }

        let byte_count = data.len() as u64;

        if byte_count > MAX_CHUNK_SIZE {
            return PutChunkResult::ChunkTooBig;
        }

        if (self.total_bytes + byte_count) > self.max_bytes {
            return PutChunkResult::Full;
        }

        let pending_blob_to_insert = match self.pending_blobs.entry(blob_id) {
            Vacant(e) => {
                let mut pending_blob = PendingBlob::new(now);
                pending_blob.meta = meta;
                pending_blob.add_chunk(chunk_index, data);
                if pending_blob.is_complete() {
                    Some(pending_blob)
                } else {
                    e.insert(pending_blob);
                    None
                }
            }
            Occupied(mut e) => {
                let pending_blob = e.get_mut();
                if !pending_blob.add_chunk(chunk_index, data) {
                    return PutChunkResult::ChunkAlreadyExists;
                }
                if meta.is_some() {
                    pending_blob.meta = meta;
                }
                if pending_blob.is_complete() {
                    Some(e.remove())
                } else {
                    None
                }
            }
        };

        if let Some(pending_blob) = pending_blob_to_insert {
            self.blobs.insert(blob_id, Blob::from(pending_blob, now));
        }

        self.total_bytes += byte_count;
        PutChunkResult::Success
    }

    pub fn get_chunk(&self, blob_id: u128, chunk_index: u32) -> Option<&ByteBuf> {
        self.blobs.get(&blob_id)?.chunks.get(chunk_index as usize)
    }

    pub fn exists(&self, blob_id: u128, chunk_index: u32) -> bool {
        self.blobs
            .get(&blob_id)
            .map_or(false, |b| b.chunks.len() as u32 > chunk_index)
    }

    pub fn delete_blob(&mut self, blob_id: &u128) -> bool {
        if let Some(bytes_removed) = self
            .blobs
            .remove(blob_id)
            .map(|b| count_bytes(b.chunks.iter()))
            .or_else(|| self.pending_blobs.remove(blob_id).map(|b| count_bytes(b.chunks.values())))
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

#[cfg(test)]
mod tests {
    use super::*;
    use rand::seq::SliceRandom;
    use rand::thread_rng;
    use std::cell::RefCell;

    #[test]
    fn when_adding_chunks_order_is_irrelevant() {
        fn generate_chunk(index: usize) -> ByteBuf {
            let vec: Vec<_> = (0..100).into_iter().map(|_| index as u8).collect();
            ByteBuf::from(vec)
        }

        fn check_blob(blob: &Blob) {
            assert_eq!(blob.chunks.len(), 5);

            for chunk_index in 0..5 {
                let chunk = &blob.chunks[chunk_index];
                assert_eq!(chunk, &generate_chunk(chunk_index));
            }
        }

        let blob_storage = RefCell::new(BlobStorage::new(10_000));

        let mut actions: Vec<Box<dyn Fn() -> PutChunkResult>> = vec![
            Box::new(|| {
                blob_storage
                    .borrow_mut()
                    .put_first_chunk(1, "mime_type".to_string(), 5, generate_chunk(0), 1)
            }),
            Box::new(|| blob_storage.borrow_mut().put_chunk(1, 1, generate_chunk(1), 2)),
            Box::new(|| blob_storage.borrow_mut().put_chunk(1, 2, generate_chunk(2), 3)),
            Box::new(|| blob_storage.borrow_mut().put_chunk(1, 3, generate_chunk(3), 4)),
            Box::new(|| blob_storage.borrow_mut().put_chunk(1, 4, generate_chunk(4), 5)),
        ];

        let mut rng = thread_rng();

        for _ in 0..20 {
            actions.shuffle(&mut rng);

            for action in actions.iter() {
                assert!(matches!(action(), PutChunkResult::Success));
            }

            assert!(blob_storage.borrow().pending_blobs.is_empty());
            assert_eq!(blob_storage.borrow().total_bytes, 500);

            check_blob(blob_storage.borrow().get_blob(&1).unwrap());

            blob_storage.borrow_mut().delete_blob(&1);

            assert_eq!(blob_storage.borrow().total_bytes, 0);
        }
    }
}
