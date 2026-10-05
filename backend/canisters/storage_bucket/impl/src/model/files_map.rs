use crate::model::files::File;
use serde::{Deserialize, Serialize};
use stable_memory_map::{FileIdToFileKeyPrefix, KeyPrefix, LazyValue, StableMemoryMap, with_map};
use std::ops::Bound::{Excluded, Included};
use types::FileId;

#[derive(Serialize, Deserialize, Default)]
pub struct FilesMap {
    prefix: FileIdToFileKeyPrefix,
    len: usize,
}

impl StableMemoryMap<FileIdToFileKeyPrefix, File> for FilesMap {
    fn prefix(&self) -> &FileIdToFileKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: File) -> Vec<u8> {
        file_to_bytes(value)
    }

    fn bytes_to_value(_key: &FileId, bytes: Vec<u8>) -> File {
        bytes_to_file(bytes)
    }

    fn on_inserted(&mut self, _key: &FileId, existing: &Option<LazyValue<FileId, File>>) {
        if existing.is_none() {
            self.len = self.len.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &FileId, _removed: &LazyValue<FileId, File>) {
        self.len = self.len.saturating_sub(1);
    }
}

impl FilesMap {
    pub fn len(&self) -> usize {
        self.len
    }

    // Up to `max_count` files in order of file id, from just after `after`, or from the first if it
    // is `None`
    pub fn files_after(&self, after: Option<FileId>, max_count: usize) -> Vec<(FileId, File)> {
        let start = after.map_or(Included(self.prefix.create_key(&0)), |f| Excluded(self.prefix.create_key(&f)));
        let end = Included(self.prefix.create_key(&FileId::MAX));

        with_map(|m| {
            m.range((start, end))
                .take(max_count)
                .map(|(k, v)| (k.file_id(), bytes_to_file(v)))
                .collect()
        })
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
