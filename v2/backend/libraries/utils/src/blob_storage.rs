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
    max_bytes: u64,
    total_bytes: u64,
    image_bytes: u64,
    video_bytes: u64,
    audio_bytes: u64,
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
    total_chunks: u32,
    mime_type: String,
    chunks: HashMap<u32, ByteBuf>,
}

pub enum PutChunkResult {
    Success,
    Complete,
    BlobAlreadyExists,
    ChunkAlreadyExists,
    ChunkTooBig,
    Full,
}

impl PendingBlob {
    pub fn new(now: TimestampMillis, mime_type: String, total_chunks: u32) -> PendingBlob {
        PendingBlob {
            created: now,
            total_chunks,
            mime_type,
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
        self.total_chunks == self.chunks.len() as u32
    }
}

impl Blob {
    pub fn from(pending_blob: PendingBlob, now: TimestampMillis) -> Self {
        if !pending_blob.is_complete() {
            panic!("Pending blob is still incomplete");
        }

        let mut chunks = vec![ByteBuf::default(); pending_blob.total_chunks as usize];
        for (index, chunk) in pending_blob.chunks.into_iter() {
            chunks[index as usize] = chunk;
        }

        Blob {
            created: now,
            mime_type: pending_blob.mime_type,
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
            max_bytes,
            total_bytes: 0,
            image_bytes: 0,
            video_bytes: 0,
            audio_bytes: 0,
        }
    }

    pub fn get_blob(&self, blob_id: &u128) -> Option<&Blob> {
        self.blobs.get(blob_id)
    }

    pub fn put_chunk(
        &mut self,
        blob_id: u128,
        mime_type: String,
        total_chunks: u32,
        chunk_index: u32,
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

        let mime_type = mime_type.to_lowercase();

        // Update metrics
        if mime_type.starts_with("image") {
            self.image_bytes += byte_count;
        } else if mime_type.starts_with("video") {
            self.video_bytes += byte_count;
        } else if mime_type.starts_with("audio") {
            self.audio_bytes += byte_count;
        }

        let pending_blob_to_insert = match self.pending_blobs.entry(blob_id) {
            Vacant(e) => {
                let mut pending_blob = PendingBlob::new(now, mime_type, total_chunks);
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
                if pending_blob.is_complete() {
                    Some(e.remove())
                } else {
                    None
                }
            }
        };

        self.total_bytes += byte_count;

        if let Some(pending_blob) = pending_blob_to_insert {
            self.blobs.insert(blob_id, Blob::from(pending_blob, now));
            PutChunkResult::Complete
        } else {
            PutChunkResult::Success
        }
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

    pub fn metrics(&self) -> Metrics {
        Metrics {
            blob_count: self.blobs.len() as u32,
            total_bytes: self.total_bytes,
            image_bytes: self.image_bytes,
            video_bytes: self.video_bytes,
            audio_bytes: self.audio_bytes,
        }
    }
}

pub struct Metrics {
    pub blob_count: u32,
    pub total_bytes: u64,
    pub image_bytes: u64,
    pub video_bytes: u64,
    pub audio_bytes: u64,
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
                    .put_chunk(1, "mt".to_string(), 5, 0, generate_chunk(0), 1)
            }),
            Box::new(|| {
                blob_storage
                    .borrow_mut()
                    .put_chunk(1, "mt".to_string(), 5, 1, generate_chunk(1), 2)
            }),
            Box::new(|| {
                blob_storage
                    .borrow_mut()
                    .put_chunk(1, "mt".to_string(), 5, 2, generate_chunk(2), 3)
            }),
            Box::new(|| {
                blob_storage
                    .borrow_mut()
                    .put_chunk(1, "mt".to_string(), 5, 3, generate_chunk(3), 4)
            }),
            Box::new(|| {
                blob_storage
                    .borrow_mut()
                    .put_chunk(1, "mt".to_string(), 5, 4, generate_chunk(4), 5)
            }),
        ];

        let mut rng = thread_rng();

        for _ in 0..20 {
            actions.shuffle(&mut rng);

            for action in actions.iter() {
                let result = action();
                assert!(matches!(result, PutChunkResult::Success) || matches!(result, PutChunkResult::Complete));
            }

            assert!(blob_storage.borrow().pending_blobs.is_empty());
            assert_eq!(blob_storage.borrow().total_bytes, 500);

            check_blob(blob_storage.borrow().get_blob(&1).unwrap());

            blob_storage.borrow_mut().delete_blob(&1);

            assert_eq!(blob_storage.borrow().total_bytes, 0);
        }
    }
}
