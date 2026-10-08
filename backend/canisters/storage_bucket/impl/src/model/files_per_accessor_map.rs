use serde::{Deserialize, Serialize};
use stable_memory_map::{FilesPerAccessorKeyPrefix, KeyPrefix, with_map, with_map_mut};
use types::{AccessorId, FileId};

#[derive(Serialize, Deserialize, Default)]
pub struct FilesPerAccessorStableMap {
    prefix: FilesPerAccessorKeyPrefix,
}

impl FilesPerAccessorStableMap {
    pub fn get(&self, accessor_id: AccessorId) -> Vec<FileId> {
        self.get_first(accessor_id, usize::MAX)
    }

    // Returns at most `max_count` of the accessor's files
    fn get_first(&self, accessor_id: AccessorId, max_count: usize) -> Vec<FileId> {
        // Keys aren't length prefixed, so other accessors' keys can sit among this accessor's: those
        // of an accessor which this one is a byte-prefix of, and those of one which is a byte-prefix
        // of this one where the file id carries on with this one's bytes. So the keys are filtered
        // rather than taken while they match.
        let start = self.prefix.create_key(&(accessor_id, FileId::MIN));
        let end = self.prefix.create_key(&(accessor_id, FileId::MAX));
        with_map(|m| {
            m.range(start..=end)
                .filter(|(k, _)| k.accessor_id() == accessor_id)
                .map(|(k, _)| k.file_id())
                .take(max_count)
                .collect()
        })
    }

    // Unlinks at most `max_count` of the accessor's files, returning them
    pub fn remove(&mut self, accessor_id: AccessorId, max_count: usize) -> Vec<FileId> {
        let files = self.get_first(accessor_id, max_count);
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

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn get_returns_only_the_given_accessors_files() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(2)));

        // `a` is a byte-prefix of `b`, and `c` sorts after both
        let a = AccessorId::from_slice(&[1]);
        let b = AccessorId::from_slice(&[1, 1]);
        let c = AccessorId::from_slice(&[2]);

        // `a`'s files sort before `b`'s keys, among them (so within `b`'s range) and after them
        let a_files = vec![1, (1 << 120) | 3, FileId::MAX];
        let b_files = vec![2, 1 << 120];
        let c_files = vec![4];

        let mut map = FilesPerAccessorStableMap::default();
        for (accessor_id, files) in [(a, &a_files), (b, &b_files), (c, &c_files)] {
            for file_id in files {
                map.link(accessor_id, *file_id);
            }
        }

        assert_eq!(map.get(a), a_files);
        assert_eq!(map.get(b), b_files);
        assert_eq!(map.get(c), c_files);

        assert_eq!(map.remove(a, 2), a_files[..2]);
        assert_eq!(map.get(a), a_files[2..]);
        assert_eq!(map.remove(a, 2), a_files[2..]);
        assert!(map.get(a).is_empty());
        assert_eq!(map.get(b), b_files);
        assert_eq!(map.get(c), c_files);
    }
}
