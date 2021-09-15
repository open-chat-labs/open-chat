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
    orphan_chunks: HashMap<u128, HashMap<u32, ByteBuf>>,
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
    BlobAlreadyExists,
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
            chunks: vec![ByteBuf::default(); total_chunks as usize],
        }
    }

    pub fn add_chunk(&mut self, index: usize, data: ByteBuf) -> bool {
        if self.chunks[index].is_empty() {
            self.chunks[index] = data;
            self.chunks_remaining -= 1;
            true
        } else {
            false
        }
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
            return PutChunkResult::BlobAlreadyExists;
        }

        let byte_count = data.len() as u64;

        if byte_count > MAX_CHUNK_SIZE {
            return PutChunkResult::ChunkTooBig;
        }

        if (self.total_bytes + byte_count) > self.max_bytes {
            return PutChunkResult::Full;
        }

        if total_chunks == 1 {
            self.blobs.insert(
                blob_id,
                Blob {
                    created: now,
                    mime_type,
                    chunks: vec![data],
                },
            );
        } else {
            match self.pending_blobs.entry(blob_id) {
                Vacant(e) => {
                    let mut pending_blob = PendingBlob::new(now, mime_type, total_chunks);
                    pending_blob.add_chunk(0, data);

                    if let Some(existing_chunks) = self.orphan_chunks.remove(&blob_id) {
                        for (index, chunk) in existing_chunks.into_iter() {
                            pending_blob.add_chunk(index as usize, chunk);
                        }
                    }

                    if pending_blob.is_complete() {
                        self.blobs.insert(blob_id, Blob::from(pending_blob, now));
                    } else {
                        e.insert(pending_blob);
                    }
                }
                Occupied(_) => return PutChunkResult::ChunkAlreadyExists,
            }
        }

        self.total_bytes += byte_count;
        PutChunkResult::Success
    }

    pub fn put_chunk(&mut self, blob_id: u128, chunk_index: u32, data: ByteBuf, now: TimestampMillis) -> PutChunkResult {
        if chunk_index == 0 {
            panic!("Must call 'put_first_chunk' when chunk_index is 0");
        }

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

        if let Occupied(mut e) = self.pending_blobs.entry(blob_id) {
            let pending_blob = e.get_mut();
            if !pending_blob.add_chunk(chunk_index as usize, data) {
                return PutChunkResult::ChunkAlreadyExists;
            }
            if pending_blob.is_complete() {
                let blob = Blob::from(e.remove(), now);
                self.blobs.insert(blob_id, blob);
            }
        } else {
            match self.orphan_chunks.entry(blob_id) {
                Occupied(e) => {
                    if e.get().contains_key(&chunk_index) {
                        return PutChunkResult::ChunkAlreadyExists;
                    }
                    e.into_mut().insert(chunk_index, data);
                }
                Vacant(e) => {
                    e.insert(vec![(chunk_index, data)].into_iter().collect());
                }
            }
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
            .or_else(|| self.pending_blobs.remove(blob_id).map(|b| count_bytes(b.chunks.iter())))
            .or_else(|| {
                self.orphan_chunks
                    .remove(blob_id)
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
            assert!(blob_storage.borrow().orphan_chunks.is_empty());
            assert_eq!(blob_storage.borrow().total_bytes, 500);

            check_blob(blob_storage.borrow().get_blob(&1).unwrap());

            blob_storage.borrow_mut().delete_blob(&1);

            assert_eq!(blob_storage.borrow().total_bytes, 0);
        }
    }
}
