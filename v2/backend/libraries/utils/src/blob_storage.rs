use candid::CandidType;
use serde::Deserialize;
use serde_bytes::ByteBuf;
use std::collections::HashMap;

const MAX_CHUNK_SIZE: u64 = 1024 * 1024; // 1MB

#[derive(Default, CandidType, Deserialize)]
pub struct BlobStorage {
    chunks: HashMap<(u128, u32), ByteBuf>,
    total_bytes: u64,
    max_bytes: u64,
}

pub enum PutChunkResult {
    Success,
    ChunkTooBig,
    Full,
}

impl BlobStorage {
    pub fn new(max_bytes: u64) -> BlobStorage {
        BlobStorage {
            chunks: HashMap::default(),
            total_bytes: 0,
            max_bytes,
        }
    }

    pub fn put_chunk(&mut self, blob_id: u128, chunk_index: u32, data: ByteBuf) -> PutChunkResult {
        let byte_count = data.len() as u64;

        if byte_count > MAX_CHUNK_SIZE {
            return PutChunkResult::ChunkTooBig;
        }

        if (self.total_bytes + byte_count) > self.max_bytes {
            return PutChunkResult::Full;
        }

        self.chunks.insert((blob_id, chunk_index), data);
        self.total_bytes += byte_count;
        PutChunkResult::Success
    }

    pub fn get_chunk(&self, blob_id: u128, chunk_index: u32) -> Option<&ByteBuf> {
        self.chunks.get(&(blob_id, chunk_index))
    }

    pub fn delete_blob(&mut self, blob_id: u128, blob_size: u32, chunk_size: u32) {
        let num_indexes = ((blob_size - 1) / chunk_size) + 1;
        for i in 0..num_indexes {
            self.delete_chunk(blob_id, i);
        }
    }

    pub fn get_chunk_count(&self) -> u32 {
        self.chunks.len() as u32
    }

    pub fn get_total_bytes(&self) -> u64 {
        self.total_bytes
    }

    fn delete_chunk(&mut self, blob_id: u128, chunk_index: u32) {
        if let Some(chunk) = self.chunks.remove(&(blob_id, chunk_index)) {
            self.total_bytes -= chunk.len() as u64;
        }
    }
}
