use serde::{Deserialize, Serialize};
use stable_memory_map::{with_map, with_map_mut, FilesPerAccessorKeyPrefix, KeyPrefix};
use types::{AccessorId, FileId};

#[derive(Serialize, Deserialize, Default)]
pub struct FilesPerAccessorStableMap {
    prefix: FilesPerAccessorKeyPrefix,
}

impl FilesPerAccessorStableMap {
    pub fn get(&self, accessor_id: AccessorId) -> Vec<FileId> {
        with_map(|m| {
            m.range(self.prefix.create_key(&(accessor_id, 0))..)
                .map(|(k, _)| k.file_id())
                .collect()
        })
    }

    pub fn remove(&mut self, accessor_id: AccessorId) -> Vec<FileId> {
        let files = self.get(accessor_id);
        with_map_mut(|m| {
            for file in files.iter() {
                m.remove(self.prefix.create_key(&(accessor_id, *file)));
            }
        });
        files
    }

    pub fn link(&mut self, accessor_id: AccessorId, file_id: u128) {
        with_map_mut(|m| m.insert(self.prefix.create_key(&(accessor_id, file_id)), Vec::new()));
    }

    pub fn unlink(&mut self, accessor_id: AccessorId, file_id: u128) {
        with_map_mut(|m| m.remove(self.prefix.create_key(&(accessor_id, file_id))));
    }

    #[cfg(test)]
    pub fn get_all(&self) -> std::collections::BTreeMap<AccessorId, Vec<FileId>> {
        use std::collections::BTreeMap;
        let mut map: BTreeMap<AccessorId, Vec<FileId>> = BTreeMap::new();
        with_map(|m| {
            for (key, _) in m.range(self.prefix.create_key(&(AccessorId::from_slice(&[]), 0))..) {
                map.entry(key.accessor_id()).or_default().push(key.file_id());
            }
        });
        map
    }
}
