use std::collections::HashMap;
use shared::storage::StableState;

#[derive(Default)]
pub struct BlobStorage {
    chunks: HashMap<(String, u32), Vec<u8>>
}

impl BlobStorage {
    pub fn put_chunk(&mut self, blob_id: String, chunk_index: u32, data: Vec<u8>) {
        self.chunks.insert((blob_id, chunk_index), data);
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

    fn delete_chunk(&mut self, blob_id: &String, chunk_index: u32) {
        self.chunks.remove(&(blob_id.clone(), chunk_index));
    }
}

impl StableState for BlobStorage {
    type State = Vec<(String, u32, Vec<u8>)>;

    fn drain(self) -> Vec<(String, u32, Vec<u8>)> {
        self.chunks
            .into_iter()
            .map(|((id, idx), v)| (id, idx, v))
            .collect()
    }

    fn fill(chunks: Vec<(String, u32, Vec<u8>)>) -> BlobStorage {
        let map: HashMap<(String, u32), Vec<u8>> = chunks
            .into_iter()
            .map(|(id, idx, v)| ((id, idx), v))
            .collect();

        BlobStorage {
            chunks: map
        }
    }
}

