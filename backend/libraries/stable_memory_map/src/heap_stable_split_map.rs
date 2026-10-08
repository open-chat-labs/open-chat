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
    // Values which haven't yet been moved into stable memory, which `migrate_to_stable_memory` moves
    // across. Only values read from the heap layout which preceded this one can be here.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    on_heap: HashMap<V::Id, V>,
    #[serde(default)]
    in_stable_memory: HashMap<V::Id, V::Entry>,
}

impl<V: HeapStableSplitMapValue> Default for HeapStableSplitMap<V> {
    fn default() -> Self {
        HeapStableSplitMap {
            on_heap: HashMap::new(),
            in_stable_memory: HashMap::new(),
        }
    }
}

impl<V: HeapStableSplitMapValue> HeapStableSplitMap<V> {
    // Adds values from the heap layout which preceded this one, to be moved into stable memory by
    // `migrate_to_stable_memory`
    pub fn extend_from_heap(&mut self, values: HashMap<V::Id, V>) {
        self.on_heap.extend(values);
    }

    pub fn get(&self, id: &V::Id) -> Option<HeapStableSplitMapRef<'_, V>> {
        if let Some(entry) = self.in_stable_memory.get(id) {
            Some(HeapStableSplitMapRef(RefInner::InStableMemory(Box::new(read(id, entry)))))
        } else {
            self.on_heap
                .get(id)
                .map(|value| HeapStableSplitMapRef(RefInner::OnHeap(value)))
        }
    }

    pub fn get_mut(&mut self, id: &V::Id) -> Option<HeapStableSplitMapMut<'_, V>> {
        if let Some(entry) = self.in_stable_memory.get_mut(id) {
            Some(HeapStableSplitMapMut(MutInner::InStableMemory {
                id: *id,
                value: Box::new(read(id, entry)),
                entry,
                changed: false,
            }))
        } else {
            self.on_heap
                .get_mut(id)
                .map(|value| HeapStableSplitMapMut(MutInner::OnHeap(value)))
        }
    }

    // Inserts the value, replacing any value with the same id. It is written to stable memory once
    // the `HeapStableSplitMapMut` is dropped.
    pub fn insert(&mut self, id: V::Id, value: V) -> HeapStableSplitMapMut<'_, V> {
        self.on_heap.remove(&id);
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
        HeapStableSplitMapMut(MutInner::InStableMemory {
            id,
            value: Box::new(value),
            entry,
            changed: true,
        })
    }

    pub fn remove(&mut self, id: &V::Id) -> Option<V> {
        if let Some(entry) = self.in_stable_memory.remove(id) {
            let bytes = with_map_mut(|m| m.remove(V::key(id, &entry)))
                .unwrap_or_else(|| panic!("Value with id {id:?} not found in stable memory"));
            Some(V::from_bytes(&bytes))
        } else {
            self.on_heap.remove(id)
        }
    }

    pub fn contains_key(&self, id: &V::Id) -> bool {
        self.in_stable_memory.contains_key(id) || self.on_heap.contains_key(id)
    }

    // The value's entry, without reading the value
    pub fn entry(&self, id: &V::Id) -> Option<V::Entry> {
        if let Some(entry) = self.in_stable_memory.get(id) {
            Some(*entry)
        } else {
            self.on_heap.get(id).map(|value| value.entry())
        }
    }

    // Every value's id and entry, without reading the values
    pub fn entries(&self) -> impl Iterator<Item = (V::Id, V::Entry)> + '_ {
        self.on_heap
            .iter()
            .map(|(id, value)| (*id, value.entry()))
            .chain(self.in_stable_memory.iter().map(|(id, entry)| (*id, *entry)))
    }

    pub fn ids(&self) -> impl Iterator<Item = V::Id> + '_ {
        self.on_heap.keys().chain(self.in_stable_memory.keys()).copied()
    }

    // Every value, each of which is read from stable memory as the iterator reaches it
    pub fn iter(&self) -> impl Iterator<Item = HeapStableSplitMapRef<'_, V>> {
        self.filter(|_| true)
    }

    // The values whose entries `predicate` returns true for, only those of which are read
    pub fn filter<F: Fn(&V::Entry) -> bool>(&self, predicate: F) -> impl Iterator<Item = HeapStableSplitMapRef<'_, V>> {
        let on_heap = self
            .on_heap
            .values()
            .filter(|value| predicate(&value.entry()))
            .map(|value| HeapStableSplitMapRef(RefInner::OnHeap(value)))
            .collect::<Vec<_>>();

        on_heap.into_iter().chain(
            self.in_stable_memory
                .iter()
                .filter(move |(_, entry)| predicate(entry))
                .map(|(id, entry)| HeapStableSplitMapRef(RefInner::InStableMemory(Box::new(read(id, entry))))),
        )
    }

    // Applies `f` to every value, writing back each of those in stable memory
    pub fn for_each_mut(&mut self, mut f: impl FnMut(&V::Id, &mut V)) {
        for (id, value) in self.on_heap.iter_mut() {
            f(id, value);
        }
        for (id, entry) in self.in_stable_memory.iter_mut() {
            let mut value = read(id, entry);
            f(id, &mut value);
            *entry = write(id, entry, &value);
        }
    }

    pub fn len(&self) -> usize {
        self.on_heap.len() + self.in_stable_memory.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    // The number of values which haven't yet been moved into stable memory
    pub fn count_on_heap(&self) -> usize {
        self.on_heap.len()
    }

    // Moves every value still on the heap into stable memory, returning how many were moved
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let values = std::mem::take(&mut self.on_heap);
        let count = values.len();
        let mut entries = Vec::with_capacity(count);
        for (id, value) in values {
            let entry = value.entry();
            entries.push((V::key(&id, &entry), value.to_bytes()));
            self.in_stable_memory.insert(id, entry);
        }
        // Sorted by key, since `insert_many` is far cheaper when the entries are in key order
        entries.sort_unstable_by(|(k1, _), (k2, _)| k1.cmp(k2));
        with_map_mut(|m| m.insert_many(entries));
        count
    }
}

// A value read from `HeapStableSplitMap`
pub struct HeapStableSplitMapRef<'a, V>(RefInner<'a, V>);

enum RefInner<'a, V> {
    OnHeap(&'a V),
    InStableMemory(Box<V>),
}

impl<V> Deref for HeapStableSplitMapRef<'_, V> {
    type Target = V;

    fn deref(&self) -> &V {
        match &self.0 {
            RefInner::OnHeap(value) => value,
            RefInner::InStableMemory(value) => value,
        }
    }
}

// A value borrowed mutably from `HeapStableSplitMap`. A value stored in stable memory is written back when
// this is dropped, if it was changed, which is taken to be whenever it was dereferenced mutably.
pub struct HeapStableSplitMapMut<'a, V: HeapStableSplitMapValue>(MutInner<'a, V>);

enum MutInner<'a, V: HeapStableSplitMapValue> {
    OnHeap(&'a mut V),
    InStableMemory {
        id: V::Id,
        value: Box<V>,
        entry: &'a mut V::Entry,
        changed: bool,
    },
}

impl<V: HeapStableSplitMapValue> Deref for HeapStableSplitMapMut<'_, V> {
    type Target = V;

    fn deref(&self) -> &V {
        match &self.0 {
            MutInner::OnHeap(value) => value,
            MutInner::InStableMemory { value, .. } => value,
        }
    }
}

impl<V: HeapStableSplitMapValue> DerefMut for HeapStableSplitMapMut<'_, V> {
    fn deref_mut(&mut self) -> &mut V {
        match &mut self.0 {
            MutInner::OnHeap(value) => value,
            MutInner::InStableMemory { value, changed, .. } => {
                *changed = true;
                value
            }
        }
    }
}

impl<V: HeapStableSplitMapValue> Drop for HeapStableSplitMapMut<'_, V> {
    fn drop(&mut self) {
        // Nothing is written while unwinding from a panic, which in a canister would trap anyway
        if std::thread::panicking() {
            return;
        }
        if let MutInner::InStableMemory {
            id,
            value,
            entry,
            changed: true,
        } = &mut self.0
        {
            **entry = write::<V>(id, entry, value);
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
    fn values_on_the_heap_are_read_and_changed_until_moved_into_stable_memory() {
        init();
        let mut values = HeapStableSplitMap::default();
        values.extend_from_heap(HashMap::from([(1, item("a", 10)), (2, item("b", 20))]));
        values.insert(3, item("c", 30));

        // Values on the heap survive being serialized, as when a User canister whose user is being
        // migrated is upgraded again
        let mut values: HeapStableSplitMap<Item> = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&values));
        assert_eq!(values.count_on_heap(), 2);
        assert_eq!(*values.get(&2).unwrap(), item("b", 20));
        assert_eq!(*values.get(&3).unwrap(), item("c", 30));

        values.get_mut(&1).unwrap().updated = 15;
        assert_eq!(values.get(&1).unwrap().updated, 15);
        assert_eq!(values.entry(&1), Some(15));
        assert_eq!(values.count_on_heap(), 2);
        assert_eq!(stored_count(), 1);
        assert_eq!(values.filter(|updated| *updated > 12).count(), 3);

        values.for_each_mut(|_, value| value.name.push('!'));
        assert_eq!(values.get(&1).unwrap().name, "a!");
        assert_eq!(values.get(&3).unwrap().name, "c!");

        // Inserting a value with the id of one on the heap replaces it in stable memory
        values.insert(2, item("d", 40));
        assert_eq!(values.count_on_heap(), 1);

        assert_eq!(values.migrate_to_stable_memory(), 1);
        assert_eq!(values.migrate_to_stable_memory(), 0);
        assert_eq!(values.count_on_heap(), 0);
        assert_eq!(stored_count(), 3);
        assert_eq!(*values.get(&1).unwrap(), item("a!", 15));
        assert_eq!(*values.get(&2).unwrap(), item("d", 40));
        assert_eq!(values.len(), 3);

        // Once moved, nothing is serialized for the values on the heap
        #[derive(Deserialize)]
        struct Fields {
            on_heap: Option<serde::de::IgnoredAny>,
        }
        let fields: Fields = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&values));
        assert!(fields.on_heap.is_none());
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
