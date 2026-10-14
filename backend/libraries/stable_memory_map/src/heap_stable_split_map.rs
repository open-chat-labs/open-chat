//! A map split between the heap and stable memory: each value is stored whole in the stable memory
//! map, while a small entry per value is kept on the heap, from which the values can be found (eg.
//! those updated since a given time) without reading them.
//!
//! A value is read from stable memory each time it is accessed. A value accessed via `get_mut` is
//! written back once the `HeapStableSplitMapMut` is dropped, if it was changed.

use crate::{Key, with_map, with_map_mut};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;
use std::hash::Hash;
use std::marker::PhantomData;
use std::ops::ControlFlow;
use std::ops::{Deref, DerefMut};

pub trait HeapStableSplitMapValue: Serialize + DeserializeOwned {
    // What each value is looked up by
    type Id: Copy + Eq + Hash + Debug + Serialize + DeserializeOwned;
    // What is kept on the heap for each value. It must only depend on the value, since it is only
    // updated when the value is written.
    type Entry: Copy + Serialize + DeserializeOwned;
    type Key: Key + Ord;

    fn entry(&self) -> Self::Entry;

    // The key the value is stored under, which must never change for a given value
    fn key(id: &Self::Id, entry: &Self::Entry) -> Self::Key;

    // How the value is stored. These are left to each value type, rather than this crate
    // serializing values itself, since depending on `msgpack` here makes the LocalUserIndex wasm
    // about 0.5MB larger, which takes it over the size limit.
    fn to_bytes(&self) -> Vec<u8>;

    fn from_bytes(bytes: &[u8]) -> Self;
}

#[derive(Serialize, Deserialize)]
#[serde(bound = "")]
pub struct HeapStableSplitMap<V: HeapStableSplitMapValue> {
    #[serde(default)]
    in_stable_memory: HashMap<V::Id, V::Entry>,
}

impl<V: HeapStableSplitMapValue> Default for HeapStableSplitMap<V> {
    fn default() -> Self {
        HeapStableSplitMap {
            in_stable_memory: HashMap::new(),
        }
    }
}

impl<V: HeapStableSplitMapValue> HeapStableSplitMap<V> {
    pub fn get(&self, id: &V::Id) -> Option<HeapStableSplitMapRef<'_, V>> {
        self.in_stable_memory
            .get(id)
            .map(|entry| HeapStableSplitMapRef::new(read(id, entry)))
    }

    pub fn get_mut(&mut self, id: &V::Id) -> Option<HeapStableSplitMapMut<'_, V>> {
        self.in_stable_memory.get_mut(id).map(|entry| HeapStableSplitMapMut {
            id: *id,
            value: Box::new(read(id, entry)),
            entry,
            changed: false,
        })
    }

    // Inserts the value, replacing any value with the same id. It is written to stable memory once
    // the `HeapStableSplitMapMut` is dropped.
    pub fn insert(&mut self, id: V::Id, value: V) -> HeapStableSplitMapMut<'_, V> {
        let new_entry = value.entry();
        if let Some(previous_entry) = self.in_stable_memory.insert(id, new_entry) {
            // The value being replaced is stored under a different key if the key depends on the
            // entry, in which case it is removed rather than left behind
            let previous_key = V::key(&id, &previous_entry);
            if previous_key != V::key(&id, &new_entry) {
                with_map_mut(|m| m.remove(previous_key));
            }
        }
        let entry = self.in_stable_memory.get_mut(&id).unwrap();
        HeapStableSplitMapMut {
            id,
            value: Box::new(value),
            entry,
            changed: true,
        }
    }

    pub fn remove(&mut self, id: &V::Id) -> Option<V> {
        let entry = self.in_stable_memory.remove(id)?;
        let bytes = with_map_mut(|m| m.remove(V::key(id, &entry)))
            .unwrap_or_else(|| panic!("Value with id {id:?} not found in stable memory"));
        Some(V::from_bytes(&bytes))
    }

    pub fn contains_key(&self, id: &V::Id) -> bool {
        self.in_stable_memory.contains_key(id)
    }

    // The value's entry, without reading the value
    pub fn entry(&self, id: &V::Id) -> Option<V::Entry> {
        self.in_stable_memory.get(id).copied()
    }

    // Every value's id and entry, without reading the values
    pub fn entries(&self) -> impl Iterator<Item = (V::Id, V::Entry)> + '_ {
        self.in_stable_memory.iter().map(|(id, entry)| (*id, *entry))
    }

    pub fn ids(&self) -> impl Iterator<Item = V::Id> + '_ {
        self.in_stable_memory.keys().copied()
    }

    // Every value, each of which is read from stable memory as the iterator reaches it
    pub fn iter(&self) -> impl Iterator<Item = HeapStableSplitMapRef<'_, V>> {
        self.filter(|_| true)
    }

    // The values whose entries `predicate` returns true for, only those of which are read
    pub fn filter<F: Fn(&V::Entry) -> bool>(&self, predicate: F) -> impl Iterator<Item = HeapStableSplitMapRef<'_, V>> {
        self.in_stable_memory
            .iter()
            .filter(move |(_, entry)| predicate(entry))
            .map(|(id, entry)| HeapStableSplitMapRef::new(read(id, entry)))
    }

    // Applies `f` to every value, writing them back together (see `update_many`)
    pub fn for_each_mut(&mut self, mut f: impl FnMut(&V::Id, &mut V)) {
        let ids: Vec<_> = self.ids().collect();
        self.update_many(ids, |id, value| {
            f(id, value);
            ControlFlow::<()>::Continue(())
        });
    }

    // Applies `f` to each value whose id is given in turn, skipping ids which aren't held, until it
    // returns `Break`, whose value is returned. Every value `f` was applied to is then written back,
    // all together, so that each node of the stable memory map is written once rather than once per
    // value, which saves the most when the values' keys are close together.
    pub fn update_many<B>(
        &mut self,
        ids: impl IntoIterator<Item = V::Id>,
        mut f: impl FnMut(&V::Id, &mut V) -> ControlFlow<B>,
    ) -> Option<B> {
        let mut to_write = Vec::new();
        let mut result = None;
        for id in ids {
            let Some(entry) = self.in_stable_memory.get_mut(&id) else {
                continue;
            };
            let mut value = read(&id, entry);
            let flow = f(&id, &mut value);
            let new_entry = value.entry();
            let key = V::key(&id, &new_entry);
            debug_assert!(key == V::key(&id, entry), "A value's key must never change");
            *entry = new_entry;
            to_write.push((key, value.to_bytes()));
            if let ControlFlow::Break(b) = flow {
                result = Some(b);
                break;
            }
        }
        to_write.sort_unstable_by(|(k1, _), (k2, _)| k1.cmp(k2));
        with_map_mut(|m| m.insert_many(to_write));
        result
    }

    pub fn len(&self) -> usize {
        self.in_stable_memory.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// A value read from `HeapStableSplitMap`. It holds its own copy of the value, but borrows the map so
// that the map can't be changed while it is held, which would leave it out of date.
pub struct HeapStableSplitMapRef<'a, V>(Box<V>, PhantomData<&'a ()>);

impl<V> HeapStableSplitMapRef<'_, V> {
    fn new(value: V) -> Self {
        HeapStableSplitMapRef(Box::new(value), PhantomData)
    }
}

impl<V> Deref for HeapStableSplitMapRef<'_, V> {
    type Target = V;

    fn deref(&self) -> &V {
        &self.0
    }
}

// A value borrowed mutably from `HeapStableSplitMap`. It is written back when this is dropped, if it
// was changed, which is taken to be whenever it was dereferenced mutably.
pub struct HeapStableSplitMapMut<'a, V: HeapStableSplitMapValue> {
    id: V::Id,
    value: Box<V>,
    entry: &'a mut V::Entry,
    changed: bool,
}

impl<V: HeapStableSplitMapValue> Deref for HeapStableSplitMapMut<'_, V> {
    type Target = V;

    fn deref(&self) -> &V {
        &self.value
    }
}

impl<V: HeapStableSplitMapValue> DerefMut for HeapStableSplitMapMut<'_, V> {
    fn deref_mut(&mut self) -> &mut V {
        self.changed = true;
        &mut self.value
    }
}

impl<V: HeapStableSplitMapValue> Drop for HeapStableSplitMapMut<'_, V> {
    fn drop(&mut self) {
        // Nothing is written while unwinding from a panic, which in a canister would trap anyway
        if std::thread::panicking() {
            return;
        }
        if self.changed {
            *self.entry = write::<V>(&self.id, self.entry, &self.value);
        }
    }
}

fn read<V: HeapStableSplitMapValue>(id: &V::Id, entry: &V::Entry) -> V {
    let bytes =
        with_map(|m| m.get(V::key(id, entry))).unwrap_or_else(|| panic!("Value with id {id:?} not found in stable memory"));
    V::from_bytes(&bytes)
}

// Writes the value to stable memory, given its entry as of when it was last written, returning its
// new entry
fn write<V: HeapStableSplitMapValue>(id: &V::Id, previous_entry: &V::Entry, value: &V) -> V::Entry {
    let entry = value.entry();
    let key = V::key(id, &entry);
    debug_assert!(key == V::key(id, previous_entry), "A value's key must never change");
    with_map_mut(|m| m.insert(key, value.to_bytes()));
    entry
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::KeyPrefix;
    use crate::keys::test_small_entries::{TestSmallEntriesKey, TestSmallEntriesKeyPrefix};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
    struct Item {
        name: String,
        updated: u64,
    }

    impl HeapStableSplitMapValue for Item {
        type Id = u32;
        type Entry = u64;
        type Key = TestSmallEntriesKey;

        fn entry(&self) -> u64 {
            self.updated
        }

        fn key(id: &u32, _: &u64) -> TestSmallEntriesKey {
            TestSmallEntriesKeyPrefix::new().create_key(id)
        }

        fn to_bytes(&self) -> Vec<u8> {
            msgpack::serialize_then_unwrap(self)
        }

        fn from_bytes(bytes: &[u8]) -> Self {
            msgpack::deserialize_then_unwrap(bytes)
        }
    }

    fn item(name: &str, updated: u64) -> Item {
        Item {
            name: name.to_string(),
            updated,
        }
    }

    #[test]
    fn values_are_stored_in_stable_memory_and_written_back_when_changed() {
        init();
        let mut values = HeapStableSplitMap::default();
        values.insert(1, item("a", 10));
        assert_eq!(stored_count(), 1);
        assert_eq!(values.len(), 1);
        assert!(values.contains_key(&1));
        assert_eq!(values.entry(&1), Some(10));

        // A change is written back once the `HeapStableSplitMapMut` is dropped, along with the value's entry
        values.get_mut(&1).unwrap().updated = 20;
        assert_eq!(values.get(&1).unwrap().updated, 20);
        assert_eq!(values.entry(&1), Some(20));

        // A value which is only read through a `HeapStableSplitMapMut` isn't written back
        let key = TestSmallEntriesKeyPrefix::new().create_key(&1);
        let written = with_map(|m| m.get(key.clone())).unwrap();
        {
            let value = values.get_mut(&1).unwrap();
            assert_eq!(value.name, "a");
            with_map_mut(|m| m.insert(key.clone(), vec![1, 2, 3]));
        }
        assert_eq!(with_map(|m| m.get(key.clone())), Some(vec![1, 2, 3]));
        with_map_mut(|m| m.insert(key, written));

        // The value survives serializing the `HeapStableSplitMap`, which only holds its entry
        let deserialized: HeapStableSplitMap<Item> = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&values));
        assert_eq!(*deserialized.get(&1).unwrap(), item("a", 20));

        assert_eq!(values.remove(&1), Some(item("a", 20)));
        assert_eq!(stored_count(), 0);
        assert!(values.is_empty());
        assert!(values.get(&1).is_none());
        assert!(values.remove(&1).is_none());
    }

    #[test]
    fn update_many_writes_back_each_value_updated_until_it_breaks() {
        init();
        let mut values = HeapStableSplitMap::default();
        for id in 1..=4 {
            values.insert(id, item("x", id as u64));
        }

        let result = values.update_many([3, 5, 1, 2, 4], |id, value| {
            value.updated += 10;
            if *id == 2 { ControlFlow::Break(*id) } else { ControlFlow::Continue(()) }
        });

        assert_eq!(result, Some(2));
        // 5 isn't held, and 4 comes after the value it broke on
        for (id, updated) in [(1, 11), (2, 12), (3, 13), (4, 4)] {
            assert_eq!(values.get(&id).unwrap().updated, updated);
            assert_eq!(values.entry(&id), Some(updated));
        }

        values.for_each_mut(|_, value| value.updated += 100);
        for (id, updated) in [(1, 111), (2, 112), (3, 113), (4, 104)] {
            assert_eq!(values.get(&id).unwrap().updated, updated);
        }
    }

    #[test]
    fn values_are_found_by_their_entries_without_reading_the_others() {
        init();
        let mut values = HeapStableSplitMap::default();
        for (id, updated) in [(1, 10), (2, 20), (3, 30)] {
            values.insert(id, item("x", updated));
        }
        // The values not matched are replaced with bytes which can't be read
        for id in [1, 2] {
            with_map_mut(|m| m.insert(TestSmallEntriesKeyPrefix::new().create_key(&id), vec![1, 2, 3]));
        }

        let updated: Vec<_> = values.filter(|updated| *updated > 25).map(|v| v.updated).collect();
        assert_eq!(updated, vec![30]);
        let mut entries: Vec<_> = values.entries().collect();
        entries.sort();
        assert_eq!(entries, vec![(1, 10), (2, 20), (3, 30)]);
        let mut ids: Vec<_> = values.ids().collect();
        ids.sort();
        assert_eq!(ids, vec![1, 2, 3]);
    }

    #[test]
    fn replacing_a_value_stored_under_another_key_removes_it() {
        // A value whose key depends on its entry, as a direct chat's does on its `key_id`
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
        struct Keyed(u32);

        impl HeapStableSplitMapValue for Keyed {
            type Id = u32;
            type Entry = u32;
            type Key = TestSmallEntriesKey;

            fn entry(&self) -> u32 {
                self.0
            }

            fn key(_: &u32, entry: &u32) -> TestSmallEntriesKey {
                TestSmallEntriesKeyPrefix::new().create_key(entry)
            }

            fn to_bytes(&self) -> Vec<u8> {
                msgpack::serialize_then_unwrap(self)
            }

            fn from_bytes(bytes: &[u8]) -> Self {
                msgpack::deserialize_then_unwrap(bytes)
            }
        }

        init();
        let mut values = HeapStableSplitMap::default();
        values.insert(1, Keyed(5));
        values.insert(1, Keyed(6));
        assert_eq!(stored_count(), 1);
        assert_eq!(*values.get(&1).unwrap(), Keyed(6));
        // Replacing a value with one under the same key leaves just the new one
        values.insert(1, Keyed(6));
        assert_eq!(stored_count(), 1);
    }

    fn stored_count() -> usize {
        let prefix = TestSmallEntriesKeyPrefix::new();
        with_map(|m| m.range(prefix.create_key(&0)..=prefix.create_key(&u32::MAX)).count())
    }

    fn init() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        crate::init_with_small_entries_map(memory_manager.get(MemoryId::new(1)), memory_manager.get(MemoryId::new(2)));
    }
}
