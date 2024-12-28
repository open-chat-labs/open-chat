use crate::model::files::File;
use serde::{Deserialize, Serialize};
use stable_memory_map::{with_map, with_map_mut, FileIdToFileKeyPrefix, KeyPrefix};
use types::FileId;

#[derive(Serialize, Deserialize, Default)]
pub struct FilesMap {
    prefix: FileIdToFileKeyPrefix,
    len: usize,
}

impl FilesMap {
    pub fn get(&self, file_id: &FileId) -> Option<File> {
        with_map(|m| m.get(self.prefix.create_key(file_id))).map(bytes_to_file)
    }

    pub fn contains_key(&self, file_id: &FileId) -> bool {
        with_map(|m| m.contains_key(self.prefix.create_key(file_id)))
    }

    pub fn set(&mut self, file_id: FileId, file: File) {
        if with_map_mut(|m| m.insert(self.prefix.create_key(&file_id), file_to_bytes(file))).is_none() {
            self.len = self.len.saturating_sub(1);
        }
    }

    pub fn remove(&mut self, file_id: &FileId) -> Option<File> {
        let removed = with_map_mut(|m| m.remove(self.prefix.create_key(file_id))).map(bytes_to_file);
        if removed.is_some() {
            self.len = self.len.saturating_sub(1);
        }
        removed
    }

    pub fn len(&self) -> usize {
        self.len
    }

    #[cfg(test)]
    pub fn get_all(&self) -> Vec<(FileId, File)> {
        with_map(|m| {
            m.range(self.prefix.create_key(&0)..)
                .map(|(k, v)| (k.file_id(), bytes_to_file(v)))
                .collect()
        })
    }
}

fn file_to_bytes(file: File) -> Vec<u8> {
    msgpack::serialize_then_unwrap(file)
}

fn bytes_to_file(bytes: Vec<u8>) -> File {
    msgpack::deserialize_then_unwrap(&bytes)
}
