use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use std::collections::HashMap;

const MAX_CHUNK_SIZE: u32 = 1024 * 1024; // 1MB

#[derive(Default, CandidType, Deserialize)]
pub struct BlobStorage {
    chunks: HashMap<(String, u32), Vec<u8>>,
    total_bytes: u64
}

impl BlobStorage {
    pub fn put_chunk(&mut self, blob_id: String, chunk_index: u32, data: Vec<u8>) -> bool {
        if data.len() > MAX_CHUNK_SIZE as usize {
            return false;
        }
        let byte_count = data.len() as u64;
        self.chunks.insert((blob_id, chunk_index), data);
        self.total_bytes = self.total_bytes + byte_count;
        true
    }

    pub fn get_chunk(&self, blob_id: String, chunk_index: u32) -> Option<&Vec<u8>> {
        self.chunks.get(&(blob_id, chunk_index))
    }

    pub fn delete_blob(&mut self, blob_id: &String, blob_size: u32, chunk_size: u32) {
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

    fn delete_chunk(&mut self, blob_id: &String, chunk_index: u32) {
        if let Some(chunk) = self.chunks.remove(&(blob_id.clone(), chunk_index)) {
            self.total_bytes = self.total_bytes - (chunk.len() as u64);
        }        
    }
}
