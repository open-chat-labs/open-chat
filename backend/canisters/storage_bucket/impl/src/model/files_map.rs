use crate::model::files::File;
use serde::{Deserialize, Serialize};
use stable_memory_map::{with_map, with_map_mut, FileIdToFileKeyPrefix, KeyPrefix, StableMemoryMap};
use types::FileId;

#[derive(Serialize, Deserialize, Default)]
pub struct FilesMap {
    #[serde(default)]
    map: StableMemoryMap<FileIdToFileKeyPrefix, File>,
    len: usize,
}

impl FilesMap {
    pub fn get(&self, file_id: FileId) -> Option<File> {
        self.map.get(&file_id)
    }

    pub fn contains_key(&self, file_id: FileId) -> bool {
        self.map.contains_key(&file_id)
    }

    pub fn set(&mut self, file_id: FileId, file: File) {
        if self.map.insert(&file_id, file).is_none() {
            self.len = self.len.saturating_add(1);
        }
    }

    pub fn remove(&mut self, file_id: &FileId) -> Option<File> {
        let removed = self.map.remove(file_id);
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
            m.range(self.map.prefix().create_key(&0)..)
                .map(|(k, v)| (k.file_id(), msgpack::deserialize_then_unwrap))
                .collect()
        })
    }
}
