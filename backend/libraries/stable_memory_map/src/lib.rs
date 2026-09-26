//! If you want to store data in this map and be able to iterate over it in order, then the keys
//! must maintain their ordering when represented as bytes, since the keys in the map are ordered
//! by their bytes.
//!
//! In a canister which holds many users, every key is prefixed with the index of the user it
//! belongs to as it crosses the boundary of the map (see `key_scope`).

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::{Cell, OnceCell, RefCell};
use std::marker::PhantomData;
use std::ops::{Bound, RangeBounds};

mod key_scope;
mod keys;

pub use ic_stable_structures::btreemap::entry::{OccupiedEntry, VacantEntry};
pub use key_scope::{KeyScope, with_key_scope};
pub use keys::*;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

pub type Entry<'a> = ic_stable_structures::btreemap::entry::Entry<'a, BaseKey, Vec<u8>, Memory>;

pub trait EntryExt {
    // The entry's value, or `None` if the entry is vacant
    fn value(&self) -> Option<Vec<u8>>;

    // Sets the entry's value, whether or not the entry is occupied
    fn set(self, value: Vec<u8>);
}

impl EntryExt for Entry<'_> {
    fn value(&self) -> Option<Vec<u8>> {
        match self {
            Entry::Occupied(e) => Some(e.get()),
            Entry::Vacant(_) => None,
        }
    }

    fn set(self, value: Vec<u8>) {
        match self {
            Entry::Occupied(e) => {
                e.insert(value);
            }
            Entry::Vacant(e) => {
                e.insert(value);
            }
        }
    }
}

// The page size of the map for small entries. Keys and values are unbounded so the main map uses
// the default of 1024 bytes, which suits chat events but wastes most of each page on small,
// index-like entries (~30-60 bytes). Nodes hold 5-11 entries, so 256 byte pages fit those nodes in
// 1-2 pages. This is fixed once the map is created.
pub const SMALL_ENTRIES_MAP_PAGE_SIZE: u32 = 256;

type Map = StableBTreeMap<BaseKey, Vec<u8>, Memory>;

// Entries are split between two underlying maps based on their `KeyType`'s `MapClass`. Every
// key type sharing a prefix has the same class, so every operation touches exactly one map.
pub struct StableMemoryMapInner {
    map: Map,
    // `None` if the canister was initialised without a memory for the small entries map
    small_entries_map: Option<Map>,
}

thread_local! {
    static MAP: RefCell<Option<StableMemoryMapInner>> = RefCell::default();
}

pub fn init(memory: Memory) {
    init_inner(memory, None, false);
}

pub fn init_with_small_entries_map(memory: Memory, small_entries_memory: Memory) {
    init_inner(memory, Some(small_entries_memory), false);
}

// For a canister which holds many users. Every key is scoped to a user (or to the canister
// itself) via `with_key_scope`, and accessing the map outside of a scope panics.
pub fn init_multi_user(memory: Memory, small_entries_memory: Memory) {
    init_inner(memory, Some(small_entries_memory), true);
}

fn init_inner(memory: Memory, small_entries_memory: Option<Memory>, multi_user: bool) {
    let map = Map::init(memory);
    let small_entries_map = small_entries_memory.map(|m| Map::init_with_page_size(m, SMALL_ENTRIES_MAP_PAGE_SIZE));
    key_scope::set_scoped(multi_user);
    MAP.set(Some(StableMemoryMapInner { map, small_entries_map }));
}

pub trait StableMemoryMap<KeyPrefix: crate::KeyPrefix, Value> {
    fn prefix(&self) -> &KeyPrefix;

    fn value_to_bytes(value: Value) -> Vec<u8>;

    fn bytes_to_value(key: &KeyPrefix::Suffix, bytes: Vec<u8>) -> Value;

    fn get(&self, key: &KeyPrefix::Suffix) -> Option<Value> {
        with_map(|m| m.get(self.prefix().create_key(key))).map(|v| Self::bytes_to_value(key, v))
    }

    fn contains_key(&self, key: &KeyPrefix::Suffix) -> bool {
        with_map(|m| m.contains_key(self.prefix().create_key(key)))
    }

    fn insert(&mut self, key: KeyPrefix::Suffix, value: Value) -> Option<LazyValue<KeyPrefix::Suffix, Value>> {
        let existing_bytes = with_map_mut(|m| m.insert(self.prefix().create_key(&key), Self::value_to_bytes(value)));

        let existing = existing_bytes.map(|v| {
            let key_clone = key.clone();
            LazyValue::new(key_clone, v, Self::bytes_to_value)
        });
        self.on_inserted(&key, &existing);
        existing
    }

    // Inserts `value` if there is no value for `key`, returning whether it was inserted
    fn insert_if_absent(&mut self, key: KeyPrefix::Suffix, value: Value) -> bool {
        let inserted = with_map_mut(|m| match m.entry(self.prefix().create_key(&key)) {
            Entry::Vacant(e) => {
                e.insert(Self::value_to_bytes(value));
                true
            }
            Entry::Occupied(_) => false,
        });

        if inserted {
            self.on_inserted(&key, &None);
        }
        inserted
    }

    // Applies `update_fn` to the value for `key`, then writes the value back if `update_fn` returns
    // true. Returns `None` if there is no value for `key`, otherwise whether the value was updated.
    // The key is only looked up once, rather than once to read the value and again to write it.
    //
    // The stable memory map is borrowed while `update_fn` runs, so `update_fn` must not access it,
    // whether directly or by reading any other value which is backed by it. Doing so panics. Only
    // use this where `update_fn` is fixed and can be seen not to touch the map; if the closure
    // comes from the caller, read the value and write it back in 2 separate lookups instead.
    fn update<F: FnOnce(&mut Value) -> bool>(&mut self, key: &KeyPrefix::Suffix, update_fn: F) -> Option<bool> {
        let existing_bytes = with_map_mut(|m| {
            let Entry::Occupied(e) = m.entry(self.prefix().create_key(key)) else {
                return None;
            };
            let mut value = Self::bytes_to_value(key, e.get());
            if update_fn(&mut value) {
                Some(Some(e.insert(Self::value_to_bytes(value)).into_value()))
            } else {
                Some(None)
            }
        })?;

        let Some(existing_bytes) = existing_bytes else {
            return Some(false);
        };
        self.on_inserted(key, &Some(LazyValue::new(key.clone(), existing_bytes, Self::bytes_to_value)));
        Some(true)
    }

    fn remove(&mut self, key: &KeyPrefix::Suffix) -> Option<LazyValue<KeyPrefix::Suffix, Value>> {
        let bytes_removed = with_map_mut(|m| m.remove(self.prefix().create_key(key)))?;

        let key_clone = key.clone();
        let removed = LazyValue::new(key_clone, bytes_removed, Self::bytes_to_value);
        self.on_removed(key, &removed);
        Some(removed)
    }

    // Removes the value for `key` if `predicate` returns true for it
    fn remove_if<F: FnOnce(&Value) -> bool>(
        &mut self,
        key: &KeyPrefix::Suffix,
        predicate: F,
    ) -> Option<LazyValue<KeyPrefix::Suffix, Value>> {
        let bytes_removed = with_map_mut(|m| {
            let Entry::Occupied(e) = m.entry(self.prefix().create_key(key)) else {
                return None;
            };
            predicate(&Self::bytes_to_value(key, e.get())).then(|| e.remove().into_value())
        })?;

        let removed = LazyValue::new(key.clone(), bytes_removed, Self::bytes_to_value);
        self.on_removed(key, &removed);
        Some(removed)
    }

    #[expect(unused_variables)]
    fn on_inserted(&mut self, key: &KeyPrefix::Suffix, existing: &Option<LazyValue<KeyPrefix::Suffix, Value>>) {}

    #[expect(unused_variables)]
    fn on_removed(&mut self, key: &KeyPrefix::Suffix, removed: &LazyValue<KeyPrefix::Suffix, Value>) {}
}

pub struct LazyValue<Key, Value> {
    args: Cell<Option<(Key, Vec<u8>)>>,
    value: OnceCell<Value>,
    f: fn(&Key, Vec<u8>) -> Value,
}

impl<Key, Value> LazyValue<Key, Value> {
    fn new(key: Key, value: Vec<u8>, f: fn(&Key, Vec<u8>) -> Value) -> Self {
        LazyValue {
            args: Cell::new(Some((key, value))),
            value: OnceCell::new(),
            f,
        }
    }

    pub fn value(&self) -> &Value {
        self.value.get_or_init(|| {
            let (key, bytes) = self.args.take().unwrap();
            (self.f)(&key, bytes)
        })
    }

    pub fn into_value(mut self) -> Value {
        self.value();
        self.value.take().unwrap()
    }
}

pub fn with_map<F: FnOnce(&StableMemoryMapInner) -> R, R>(f: F) -> R {
    MAP.with_borrow(|m| f(m.as_ref().unwrap()))
}

pub fn with_map_mut<F: FnOnce(&mut StableMemoryMapInner) -> R, R>(f: F) -> R {
    MAP.with_borrow_mut(|m| f(m.as_mut().unwrap()))
}

impl StableMemoryMapInner {
    pub fn get<K: Key>(&self, key: K) -> Option<Vec<u8>> {
        let (key, class) = scoped(key);
        self.map(class).get(&key)
    }

    pub fn contains_key<K: Key>(&self, key: K) -> bool {
        let (key, class) = scoped(key);
        self.map(class).contains_key(&key)
    }

    pub fn insert<K: Key>(&mut self, key: K, value: Vec<u8>) -> Option<Vec<u8>> {
        let (key, class) = scoped(key);
        self.map_mut(class).insert(key, value)
    }

    // Inserts many entries, writing each modified node to stable memory at most once rather than
    // once per entry. Unlike `insert`, the previous values aren't returned. Nodes are only written
    // once the input has moved past them, so this only helps when consecutive keys are close
    // together, meaning the entries should be supplied in key order. Out of order entries are still
    // inserted correctly, but cost no less than calling `insert` for each one.
    pub fn insert_many<K: Key>(&mut self, entries: impl IntoIterator<Item = (K, Vec<u8>)>) {
        let mut entries = entries
            .into_iter()
            .map(|(key, value)| {
                let (key, class) = scoped(key);
                (key, class, value)
            })
            .peekable();

        let Some((_, class, _)) = entries.peek() else {
            return;
        };
        let class = *class;

        self.map_mut(class).insert_many(entries.map(move |(key, entry_class, value)| {
            assert_eq!(entry_class, class, "Entries inserted together must be in the same map");
            (key, value)
        }));
    }

    pub fn remove<K: Key>(&mut self, key: K) -> Option<Vec<u8>> {
        let (key, class) = scoped(key);
        self.map_mut(class).remove(&key)
    }

    // Looks up `key` once, returning an entry through which its value can be read and then
    // inserted, replaced or removed without looking the key up again. Use this rather than `get`
    // followed by `insert` or `remove`. Looking up an entry may write to stable memory (full nodes
    // on the path to the key are split), even if the entry is only read, so use `get` or
    // `contains_key` when the value won't be written.
    pub fn entry<K: Key>(&mut self, key: K) -> Entry<'_> {
        let (key, class) = scoped(key);
        self.map_mut(class).entry(key)
    }

    pub fn range<'a, K: Key + 'a, R: RangeBounds<K>>(&'a self, range: R) -> impl DoubleEndedIterator<Item = (K, Vec<u8>)> + 'a {
        let start = map_bound(range.start_bound());
        let end = map_bound(range.end_bound());
        let map = self.map(range_map_class(&start, &end));
        let (start, end) = key_scope::scope_range(start, end);

        Iter {
            inner: map.range((start, end)).map(|e| e.into_pair()),
            _phantom: PhantomData,
        }
    }

    fn map(&self, class: MapClass) -> &Map {
        match class {
            MapClass::Default => &self.map,
            MapClass::SmallEntries => self.small_entries_map.as_ref().expect(SMALL_ENTRIES_MAP_UNAVAILABLE),
        }
    }

    fn map_mut(&mut self, class: MapClass) -> &mut Map {
        match class {
            MapClass::Default => &mut self.map,
            MapClass::SmallEntries => self.small_entries_map.as_mut().expect(SMALL_ENTRIES_MAP_UNAVAILABLE),
        }
    }
}

const SMALL_ENTRIES_MAP_UNAVAILABLE: &str =
    "The small entries map is unavailable, initialise the stable memory map using `init_with_small_entries_map`";

// The map a key belongs to is decided by its key type, which is only the first byte before the
// key is scoped, so the class must be read before the scope is applied
fn scoped<K: Into<BaseKey>>(key: K) -> (BaseKey, MapClass) {
    let key: BaseKey = key.into();
    let class = map_class(key.as_slice());
    (key_scope::scope_key(key), class)
}

// Both bounds of a range must be of the same class, and at least one must be bounded, otherwise we
// can't tell which map the range is over
fn range_map_class(start: &Bound<BaseKey>, end: &Bound<BaseKey>) -> MapClass {
    let class = |bound: &Bound<BaseKey>| match bound {
        Bound::Included(k) | Bound::Excluded(k) => Some(map_class(k.as_slice())),
        Bound::Unbounded => None,
    };

    match (class(start), class(end)) {
        (Some(s), Some(e)) => {
            assert_eq!(s, e, "Range bounds are in different maps");
            s
        }
        (Some(c), None) | (None, Some(c)) => c,
        (None, None) => panic!("Ranges over the stable memory map must be bounded on at least one side"),
    }
}

pub fn garbage_collect(prefix: BaseKeyPrefix) -> Result<u32, u32> {
    // Keep deleting while < 2B instructions have been used so far
    garbage_collect_while(prefix, || ic_cdk::api::instruction_counter() < 2_000_000_000)
}

// Deletes the keys under the prefix in batches of 100, checking `keep_going` before each batch.
// Returns `Ok(count)` once every key is deleted, or `Err(count)` if `keep_going` stopped it first
fn garbage_collect_while(prefix: BaseKeyPrefix, keep_going: impl Fn() -> bool) -> Result<u32, u32> {
    let mut total_count = 0;
    with_map_mut(|m| {
        let (prefix, class) = scoped(BaseKey::from(prefix));
        let map = m.map_mut(class);

        while keep_going() {
            let keys: Vec<_> = map
                .range(prefix.clone()..)
                .take_while(|e| e.key().as_slice().starts_with(prefix.as_slice()))
                .take(100)
                .map(|e| e.key().clone())
                .collect();

            let batch_count = keys.len() as u32;
            total_count += batch_count;
            for key in keys {
                map.remove(&key);
            }
            // If batch count < 100 then we are finished
            if batch_count < 100 {
                return Ok(total_count);
            }
        }
        Err(total_count)
    })
}

// Deletes every entry of the user at `index` from both maps, in a canister which holds many users,
// which is how a deleted user's data is removed. As with `garbage_collect`, returns `Ok(count)`
// once every entry is deleted, or `Err(count)` if it ran out of instructions first, in which case
// it should be called again. It works on the raw keys, so ignores any current key scope.
pub fn garbage_collect_user(index: u16) -> Result<u32, u32> {
    garbage_collect_user_while(index, || ic_cdk::api::instruction_counter() < 2_000_000_000)
}

fn garbage_collect_user_while(index: u16, keep_going: impl Fn() -> bool) -> Result<u32, u32> {
    let (start, end) = key_scope::user_scope_bounds(index);
    let mut total_count = 0;
    with_map_mut(|m| {
        for class in [MapClass::Default, MapClass::SmallEntries] {
            if matches!(class, MapClass::SmallEntries) && m.small_entries_map.is_none() {
                continue;
            }
            let map = m.map_mut(class);
            loop {
                if !keep_going() {
                    return Err(total_count);
                }
                let keys: Vec<_> = map
                    .range(start.clone()..end.clone())
                    .take(100)
                    .map(|e| e.key().clone())
                    .collect();

                let batch_count = keys.len() as u32;
                total_count += batch_count;
                for key in keys {
                    map.remove(&key);
                }
                // If batch count < 100 then this map is finished
                if batch_count < 100 {
                    break;
                }
            }
        }
        Ok(total_count)
    })
}

// Reads the raw entries of both maps in key order, starting after the key `after`, eg. for a canister
// which holds a single user to export everything it holds. As with any other access to the map, in a
// canister which holds many users only the entries in the current key scope are read, and their keys
// are returned without the scope, as `after` is given. Stops before an entry would take the total
// size read past `max_bytes`, though always reads at least one entry. Each entry counts as its key
// and value plus `ENTRY_ENCODING_OVERHEAD`, so that `max_bytes` bounds the entries once encoded.
pub fn read_all_entries(after: Option<&[u8]>, max_bytes: usize) -> ReadAllEntriesResult {
    let start = match after {
        Some(key) => Bound::Excluded(BaseKey::new(key.to_vec())),
        None => Bound::Unbounded,
    };
    let range = key_scope::scope_range(start, Bound::Unbounded);

    with_map(|m| {
        let mut main = m.map.range(range.clone()).map(|e| e.into_pair()).peekable();
        let mut small = m
            .small_entries_map
            .iter()
            .flat_map(|map| map.range(range.clone()))
            .map(|e| e.into_pair())
            .peekable();

        let mut entries = Vec::new();
        let mut total_bytes = 0;
        loop {
            // Each key is in exactly one of the maps, so the two never hold the same key
            let size = |(key, value): &(BaseKey, Vec<u8>)| key.as_slice().len() + value.len() + ENTRY_ENCODING_OVERHEAD;
            let (from_main, size) = match (main.peek(), small.peek()) {
                (Some(main_entry), Some(small_entry)) => {
                    if main_entry.0 < small_entry.0 {
                        (true, size(main_entry))
                    } else {
                        (false, size(small_entry))
                    }
                }
                (Some(main_entry), None) => (true, size(main_entry)),
                (None, Some(small_entry)) => (false, size(small_entry)),
                (None, None) => return ReadAllEntriesResult { entries, finished: true },
            };

            if !entries.is_empty() && total_bytes + size > max_bytes {
                return ReadAllEntriesResult {
                    entries,
                    finished: false,
                };
            }

            let (key, value) = if from_main { main.next() } else { small.next() }.unwrap();
            total_bytes += size;
            entries.push((key_scope::unscope_key(key).into_vec(), value));
        }
    })
}

// Inserts entries as returned by `read_all_entries`, eg. those exported from a canister which held a
// single user, into the current key scope, each into whichever map its key belongs in
pub fn insert_raw_entries(entries: Vec<(Vec<u8>, Vec<u8>)>) {
    with_map_mut(|m| {
        for (key, value) in entries {
            let (key, class) = scoped(BaseKey::new(key));
            m.map_mut(class).insert(key, value);
        }
    })
}

// The most an entry's encoding adds to its key and value, eg. with msgpack a 2 element array (1 byte)
// holding 2 byte arrays (each with a header of up to 5 bytes)
pub const ENTRY_ENCODING_OVERHEAD: usize = 11;

pub struct ReadAllEntriesResult {
    // Each entry's raw key and value
    pub entries: Vec<(Vec<u8>, Vec<u8>)>,
    // Whether there are no entries left after these
    pub finished: bool,
}

fn map_bound<K: Key>(bound: Bound<&K>) -> Bound<BaseKey> {
    match bound {
        Bound::Included(k) => Bound::Included(k.clone().into()),
        Bound::Excluded(k) => Bound::Excluded(k.clone().into()),
        Bound::Unbounded => Bound::Unbounded,
    }
}

struct Iter<K, I> {
    inner: I,
    _phantom: PhantomData<K>,
}

impl<K: Key, I: Iterator<Item = (BaseKey, Vec<u8>)>> Iterator for Iter<K, I> {
    type Item = (K, Vec<u8>);

    fn next(&mut self) -> Option<Self::Item> {
        self.inner.next().and_then(try_map_key_value::<K>)
    }
}

impl<K: Key, I: DoubleEndedIterator<Item = (BaseKey, Vec<u8>)>> DoubleEndedIterator for Iter<K, I> {
    fn next_back(&mut self) -> Option<Self::Item> {
        self.inner.next_back().and_then(try_map_key_value::<K>)
    }
}

fn try_map_key_value<K: Key>((key, value): (BaseKey, Vec<u8>)) -> Option<(K, Vec<u8>)> {
    K::try_from(key_scope::unscope_key(key)).ok().map(|k| (k, value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::test_small_entries::{TestSmallEntriesKey, TestSmallEntriesKeyPrefix};
    use ic_principal::Principal;
    use ic_stable_structures::Memory as _;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::MAX_USER_INDEX;

    const MAIN: MemoryId = MemoryId::new(0);
    const SMALL: MemoryId = MemoryId::new(1);

    #[test]
    fn small_entries_map_uses_small_page_size() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        assert_eq!(page_size(&memory_manager.get(MAIN)), 1024);
        assert_eq!(page_size(&memory_manager.get(SMALL)), SMALL_ENTRIES_MAP_PAGE_SIZE);
    }

    #[test]
    fn entries_are_routed_by_key_type() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_map_mut(|m| {
            for i in 0..100 {
                m.insert(small_key(i), i.to_be_bytes().to_vec());
            }
            m.insert(default_key(), vec![1]);
        });

        with_map(|m| {
            assert_eq!(m.map.len(), 1);
            assert_eq!(m.small_entries_map.as_ref().unwrap().len(), 100);

            assert_eq!(m.get(small_key(7)), Some(7u32.to_be_bytes().to_vec()));
            assert!(m.contains_key(small_key(99)));
            assert!(!m.contains_key(small_key(100)));
            assert_eq!(m.get(default_key()), Some(vec![1]));

            let forward: Vec<_> = m.range(small_key(10)..small_key(15)).map(|(k, _)| suffix(&k)).collect();
            assert_eq!(forward, vec![10, 11, 12, 13, 14]);

            let backward: Vec<_> = m.range(..=small_key(3)).rev().map(|(k, _)| suffix(&k)).collect();
            assert_eq!(backward, vec![3, 2, 1, 0]);
        });

        with_map_mut(|m| {
            assert_eq!(m.remove(small_key(7)), Some(7u32.to_be_bytes().to_vec()));
            assert!(m.get(small_key(7)).is_none());
            assert_eq!(m.small_entries_map.as_ref().unwrap().len(), 99);
        });
    }

    #[test]
    fn insert_many_matches_inserting_one_at_a_time() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        // Interleave existing keys with new ones, and include some out of order keys and an
        // overwritten key
        with_map_mut(|m| {
            for i in (0..1000).step_by(2) {
                m.insert(small_key(i), vec![0]);
            }
            m.insert_many(
                (0..1000)
                    .map(|i| (small_key(i), i.to_be_bytes().to_vec()))
                    .chain([(small_key(5000), vec![1]), (small_key(10), vec![2])]),
            );
            m.insert_many(std::iter::once((default_key(), vec![3])));
            m.insert_many(Vec::<(TestSmallEntriesKey, Vec<u8>)>::new());
        });

        with_map(|m| {
            assert_eq!(m.map.len(), 1);
            assert_eq!(m.small_entries_map.as_ref().unwrap().len(), 1001);
            for i in (0..1000).filter(|i| *i != 10) {
                assert_eq!(m.get(small_key(i)), Some(i.to_be_bytes().to_vec()));
            }
            assert_eq!(m.get(small_key(10)), Some(vec![2]));
            assert_eq!(m.get(small_key(5000)), Some(vec![1]));
            assert_eq!(m.get(default_key()), Some(vec![3]));

            let keys: Vec<_> = m.range(small_key(0)..).map(|(k, _)| suffix(&k)).collect();
            assert_eq!(keys, (0..1000).chain([5000]).collect::<Vec<_>>());
        });
    }

    #[test]
    fn entries_via_entry_api_are_routed_by_key_type() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_map_mut(|m| {
            m.entry(small_key(1)).or_insert(vec![1]);
            m.entry(default_key()).or_insert(vec![2]);
            m.entry(small_key(1)).and_modify(|v| v.push(3)).or_insert(vec![4]);
            assert_eq!(m.entry(small_key(1)).value(), Some(vec![1, 3]));
            assert!(m.entry(small_key(2)).value().is_none());
            m.entry(small_key(2)).set(vec![5]);
            m.entry(small_key(2)).set(vec![6]);
            if let Entry::Occupied(e) = m.entry(default_key()) {
                assert_eq!(e.remove().into_value(), vec![2]);
            }
            assert!(matches!(m.entry(default_key()), Entry::Vacant(_)));
        });

        with_map(|m| {
            assert_eq!(m.map.len(), 0);
            assert_eq!(m.small_entries_map.as_ref().unwrap().len(), 2);
            assert_eq!(m.get(small_key(1)), Some(vec![1, 3]));
            assert_eq!(m.get(small_key(2)), Some(vec![6]));
        });
    }

    #[test]
    fn trait_methods_update_the_map_and_call_hooks() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));
        let mut map = CountingMap {
            prefix: TestSmallEntriesKeyPrefix::new(),
            len: 0,
        };

        assert!(map.insert_if_absent(1, 10));
        assert!(!map.insert_if_absent(1, 20));
        assert!(map.insert_if_absent(2, 20));
        assert_eq!(map.get(&1), Some(10));
        assert_eq!(map.len, 2);

        assert_eq!(
            map.update(&1, |v| {
                *v += 1;
                true
            }),
            Some(true)
        );
        assert_eq!(
            map.update(&2, |v| {
                *v += 1;
                false
            }),
            Some(false)
        );
        assert_eq!(map.update(&3, |_| true), None);
        assert_eq!(map.get(&1), Some(11));
        assert_eq!(map.get(&2), Some(20));
        assert!(!map.contains_key(&3));
        assert_eq!(map.len, 2);

        assert!(map.remove_if(&1, |v| *v == 10).is_none());
        assert!(map.remove_if(&3, |_| true).is_none());
        assert_eq!(map.remove_if(&1, |v| *v == 11).map(|v| v.into_value()), Some(11));
        assert!(!map.contains_key(&1));
        assert!(map.contains_key(&2));
        assert_eq!(map.len, 1);
    }

    struct CountingMap {
        prefix: TestSmallEntriesKeyPrefix,
        len: usize,
    }

    impl StableMemoryMap<TestSmallEntriesKeyPrefix, u32> for CountingMap {
        fn prefix(&self) -> &TestSmallEntriesKeyPrefix {
            &self.prefix
        }

        fn value_to_bytes(value: u32) -> Vec<u8> {
            value.to_be_bytes().to_vec()
        }

        fn bytes_to_value(_key: &u32, bytes: Vec<u8>) -> u32 {
            u32::from_be_bytes(bytes.try_into().unwrap())
        }

        fn on_inserted(&mut self, _key: &u32, existing: &Option<LazyValue<u32, u32>>) {
            if existing.is_none() {
                self.len += 1;
            }
        }

        fn on_removed(&mut self, _key: &u32, _removed: &LazyValue<u32, u32>) {
            self.len -= 1;
        }
    }

    #[test]
    fn small_entries_map_can_be_reloaded() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));
        with_map_mut(|m| m.insert(small_key(1), vec![1]));

        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        assert_eq!(with_map(|m| m.get(small_key(1))), Some(vec![1]));
        assert_eq!(page_size(&memory_manager.get(SMALL)), SMALL_ENTRIES_MAP_PAGE_SIZE);
    }

    #[test]
    #[should_panic(expected = "The small entries map is unavailable")]
    fn inserting_small_entry_without_small_entries_map_panics() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init(memory_manager.get(MAIN));

        with_map_mut(|m| m.insert(small_key(1), vec![1]));
    }

    #[test]
    #[should_panic(expected = "Range bounds are in different maps")]
    fn range_across_maps_panics() {
        range_map_class(&Bound::Included(default_key().into()), &Bound::Excluded(small_key(1).into()));
    }

    #[test]
    fn garbage_collecting_a_user_removes_only_their_entries() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        let scopes = [KeyScope::User(1), KeyScope::User(2), KeyScope::User(3), KeyScope::Canister];
        for scope in scopes {
            with_key_scope(scope, || {
                with_map_mut(|m| {
                    for i in 0..250 {
                        m.insert(small_key(i), vec![1]);
                    }
                    m.insert(default_key(), vec![1]);
                })
            });
        }

        // Stopped after two batches (the user's one entry in the main map, then 100 of their 250 in
        // the small entries map), then finished off
        let calls = std::cell::Cell::new(0);
        assert_eq!(
            garbage_collect_user_while(2, || {
                calls.set(calls.get() + 1);
                calls.get() <= 2
            }),
            Err(101)
        );
        assert_eq!(garbage_collect_user_while(2, || true), Ok(150));

        with_key_scope(KeyScope::User(2), || {
            with_map(|m| {
                assert!(m.range(small_key(0)..).next().is_none());
                assert!(m.get(default_key()).is_none());
            })
        });
        for scope in [KeyScope::User(1), KeyScope::User(3), KeyScope::Canister] {
            with_key_scope(scope, || {
                with_map(|m| {
                    assert_eq!(m.range(small_key(0)..).count(), 250);
                    assert!(m.get(default_key()).is_some());
                })
            });
        }
    }

    #[test]
    fn multi_user_entries_are_kept_apart_by_scope() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        // Every scope stores the same keys, via each way of inserting
        let scopes = [
            KeyScope::User(0),
            KeyScope::User(1),
            KeyScope::User(MAX_USER_INDEX),
            KeyScope::Canister,
        ];
        for (i, scope) in scopes.into_iter().enumerate() {
            let value = vec![i as u8];
            with_key_scope(scope, || {
                with_map_mut(|m| {
                    m.insert(small_key(1), value.clone());
                    m.insert(default_key(), value.clone());
                    m.entry(small_key(2)).set(value.clone());
                    m.insert_many([(small_key(3), value.clone()), (small_key(4), value.clone())]);
                })
            });
        }

        for (i, scope) in scopes.into_iter().enumerate() {
            let value = vec![i as u8];
            with_key_scope(scope, || {
                with_map(|m| {
                    assert_eq!(m.get(small_key(1)), Some(value.clone()));
                    assert_eq!(m.get(default_key()), Some(value.clone()));
                    assert_eq!(m.get(small_key(2)), Some(value.clone()));
                    assert!(m.contains_key(small_key(3)));
                    assert!(!m.contains_key(small_key(5)));

                    // Ranges stay within the scope however they are bounded
                    let unbounded_end: Vec<_> = m.range(small_key(0)..).map(|(k, v)| (suffix(&k), v)).collect();
                    assert_eq!(unbounded_end, [1, 2, 3, 4].map(|s| (s, value.clone())));
                    let unbounded_start: Vec<_> = m.range(..=small_key(3)).rev().map(|(k, _)| suffix(&k)).collect();
                    assert_eq!(unbounded_start, vec![3, 2, 1]);
                    let bounded: Vec<_> = m.range(small_key(2)..small_key(4)).map(|(k, _)| suffix(&k)).collect();
                    assert_eq!(bounded, vec![2, 3]);
                })
            });
        }

        // Removing from one scope leaves the others untouched
        with_key_scope(KeyScope::User(1), || {
            with_map_mut(|m| {
                assert_eq!(m.remove(small_key(1)), Some(vec![1]));
                assert!(m.get(small_key(1)).is_none());
                if let Entry::Occupied(e) = m.entry(default_key()) {
                    assert_eq!(e.remove().into_value(), vec![1]);
                }
            })
        });
        with_key_scope(KeyScope::User(0), || {
            with_map(|m| assert_eq!(m.get(small_key(1)), Some(vec![0])))
        });
        with_map(|m| {
            assert_eq!(m.map.len(), 3);
            assert_eq!(m.small_entries_map.as_ref().unwrap().len(), 15);
        });

        // Each scope's entries are contiguous and the canister's come last
        let scope_bytes: Vec<[u8; 2]> = with_map(|m| {
            m.small_entries_map
                .as_ref()
                .unwrap()
                .iter()
                .map(|e| e.key().as_slice()[..2].try_into().unwrap())
                .collect()
        });
        let expected: Vec<[u8; 2]> = [[0, 0]; 4]
            .into_iter()
            .chain([[0, 1]; 3])
            .chain([[0x7F, 0xFF]; 4])
            .chain([[0xFF, 0xFF]; 4])
            .collect();
        assert_eq!(scope_bytes, expected);
    }

    #[test]
    fn nested_key_scopes_restore_the_outer_scope() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_key_scope(KeyScope::User(1), || {
            with_map_mut(|m| m.insert(small_key(1), vec![1]));
            with_key_scope(KeyScope::User(2), || {
                with_map_mut(|m| m.insert(small_key(1), vec![2]));
                assert_eq!(with_map(|m| m.get(small_key(1))), Some(vec![2]));
            });
            assert_eq!(with_map(|m| m.get(small_key(1))), Some(vec![1]));
        });
    }

    #[test]
    fn multi_user_entries_survive_reload() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        let user = KeyScope::User(1);
        with_key_scope(user, || with_map_mut(|m| m.insert(default_key(), vec![1])));

        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        assert_eq!(with_key_scope(user, || with_map(|m| m.get(default_key()))), Some(vec![1]));
    }

    #[test]
    fn multi_user_garbage_collect_only_removes_the_current_scope() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        // More than one batch of keys under the prefix in every scope, plus a key with a different
        // prefix in the scope being collected, which must survive
        let scopes = [KeyScope::User(1), KeyScope::User(2), KeyScope::Canister];
        for scope in scopes {
            with_key_scope(scope, || {
                with_map_mut(|m| m.insert_many((0..150).map(|i| (small_key(i), vec![i as u8]))));
            });
        }
        with_key_scope(KeyScope::User(1), || with_map_mut(|m| m.insert(default_key(), vec![1])));

        let prefix = || BaseKeyPrefix::from(TestSmallEntriesKeyPrefix::new());
        let count_under_prefix = || with_map(|m| m.range(small_key(0)..).count());

        // Stopping after the first batch reports the partial count and leaves the rest in place
        let batches = std::cell::Cell::new(0);
        let stopped_early = with_key_scope(KeyScope::User(1), || {
            garbage_collect_while(prefix(), || {
                batches.set(batches.get() + 1);
                batches.get() == 1
            })
        });
        assert_eq!(stopped_early, Err(100));
        assert_eq!(with_key_scope(KeyScope::User(1), count_under_prefix), 50);

        // Running to completion removes the rest of the scope's keys under the prefix and nothing else
        let completed = with_key_scope(KeyScope::User(1), || garbage_collect_while(prefix(), || true));
        assert_eq!(completed, Ok(50));
        with_key_scope(KeyScope::User(1), || {
            assert_eq!(count_under_prefix(), 0);
            assert_eq!(with_map(|m| m.get(default_key())), Some(vec![1]));
        });
        for scope in [KeyScope::User(2), KeyScope::Canister] {
            assert_eq!(with_key_scope(scope, count_under_prefix), 150);
        }
        with_map(|m| assert_eq!(m.small_entries_map.as_ref().unwrap().len(), 300));
    }

    #[test]
    #[should_panic(expected = "The stable memory map must be accessed within `with_key_scope`")]
    fn accessing_multi_user_map_outside_key_scope_panics() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_map(|m| m.get(small_key(1)));
    }

    #[test]
    #[should_panic(expected = "Keys are only scoped in a canister initialised with `init_multi_user`")]
    fn key_scope_in_single_user_canister_panics() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_key_scope(KeyScope::User(1), || with_map(|m| m.get(small_key(1))));
    }

    // Moving a key type which already holds data to the other map would orphan that data, so the
    // key types which existed before the small entries map was introduced must stay in the main map
    #[test]
    fn existing_key_types_stay_in_main_map() {
        for key_type in KeyType::all().filter(|kt| (*kt as u8) <= KeyType::BlockedUsers as u8) {
            assert_eq!(key_type.map_class(), MapClass::Default, "{key_type:?}");
        }
        // Key types added since then which are also in the main map
        let added_to_main_map = [
            KeyType::DirectChatMessageEventIndexes,
            KeyType::GroupChatMessageEventIndexes,
            KeyType::ChannelMessageEventIndexes,
            KeyType::DirectChatThreadMessageEventIndexes,
            KeyType::GroupChatThreadMessageEventIndexes,
            KeyType::ChannelThreadMessageEventIndexes,
            KeyType::TokenSwap,
            KeyType::P2PSwap,
            KeyType::DirectChatEvent,
            KeyType::DirectChatThreadEvent,
            KeyType::Contact,
            KeyType::ProfileDocument,
        ];
        for key_type in added_to_main_map {
            assert_eq!(key_type.map_class(), MapClass::Default, "{key_type:?}");
        }
        assert_eq!(
            KeyType::all().filter(|kt| kt.map_class() == MapClass::Default).count(),
            KeyType::BlockedUsers as usize + added_to_main_map.len()
        );
    }

    #[test]
    fn read_all_entries_merges_both_maps_in_key_order() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_map_mut(|m| {
            for i in 0..10 {
                m.insert(small_key(i), vec![0; 10]);
            }
            m.insert(default_key(), vec![1; 10]);
        });

        let expected: Vec<Vec<u8>> = {
            let mut keys: Vec<Vec<u8>> = (0..10).map(|i| BaseKey::from(small_key(i)).into_vec()).collect();
            keys.push(BaseKey::from(default_key()).into_vec());
            keys.sort();
            keys
        };

        // Everything in one page
        let ReadAllEntriesResult { entries, finished } = read_all_entries(None, usize::MAX);
        assert!(finished);
        assert_eq!(entries.iter().map(|(k, _)| k.clone()).collect::<Vec<_>>(), expected);

        // Page by page, each of which fits only 2 entries, continuing after the last key read
        let entry_size = entries[0].0.len() + 10 + ENTRY_ENCODING_OVERHEAD;
        let mut read = Vec::new();
        let mut after: Option<Vec<u8>> = None;
        loop {
            let ReadAllEntriesResult { entries: page, finished } = read_all_entries(after.as_deref(), 2 * entry_size + 5);
            assert!(page.len() <= 2);
            after = page.last().map(|(k, _)| k.clone());
            read.extend(page.into_iter().map(|(k, _)| k));
            if finished {
                break;
            }
        }
        assert_eq!(read, expected);
    }

    #[test]
    fn read_all_entries_interleaves_the_two_maps() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        // Key types 2 and 57 are in the main map, 17 and 23 in the small entries map
        let keys: Vec<Vec<u8>> = vec![vec![2, 1], vec![17, 1], vec![23, 1], vec![57, 1], vec![57, 2]];
        with_map_mut(|m| {
            for key in keys.iter().rev() {
                m.map_mut(map_class(key)).insert(BaseKey::new(key.clone()), vec![0; 10]);
            }
        });

        let mut read = Vec::new();
        let mut after: Option<Vec<u8>> = None;
        loop {
            // Each page fits a single entry
            let ReadAllEntriesResult { entries, finished } = read_all_entries(after.as_deref(), 1);
            assert!(entries.len() <= 1);
            after = entries.last().map(|(k, _)| k.clone());
            read.extend(entries.into_iter().map(|(k, _)| k));
            if finished {
                break;
            }
        }
        assert_eq!(read, keys);
    }

    #[test]
    fn read_all_entries_reads_only_the_current_scope() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        for (scope, value) in [(KeyScope::User(1), 1), (KeyScope::User(2), 2), (KeyScope::Canister, 3)] {
            with_key_scope(scope, || {
                with_map_mut(|m| {
                    for i in 0..3 {
                        m.insert(small_key(i), vec![value]);
                    }
                    m.insert(default_key(), vec![value]);
                })
            });
        }

        let unscoped_keys: Vec<Vec<u8>> = {
            let mut keys: Vec<Vec<u8>> = (0..3).map(|i| BaseKey::from(small_key(i)).into_vec()).collect();
            keys.push(BaseKey::from(default_key()).into_vec());
            keys.sort();
            keys
        };

        with_key_scope(KeyScope::User(2), || {
            let ReadAllEntriesResult { entries, finished } = read_all_entries(None, usize::MAX);
            assert!(finished);
            assert_eq!(entries.iter().map(|(k, _)| k.clone()).collect::<Vec<_>>(), unscoped_keys);
            assert!(entries.iter().all(|(_, v)| *v == vec![2]));

            // Continuing after a key returned, which is unscoped
            let ReadAllEntriesResult { entries, finished } = read_all_entries(Some(&unscoped_keys[1]), usize::MAX);
            assert!(finished);
            assert_eq!(entries.iter().map(|(k, _)| k.clone()).collect::<Vec<_>>(), unscoped_keys[2..]);
        });
    }

    #[test]
    fn raw_entries_are_inserted_into_the_current_scope() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_multi_user(memory_manager.get(MAIN), memory_manager.get(SMALL));

        let entries: Vec<(Vec<u8>, Vec<u8>)> = {
            let mut entries: Vec<_> = (0..3)
                .map(|i| (BaseKey::from(small_key(i)).into_vec(), vec![i as u8]))
                .collect();
            entries.push((BaseKey::from(default_key()).into_vec(), vec![10]));
            entries.sort();
            entries
        };

        with_key_scope(KeyScope::User(1), || insert_raw_entries(entries.clone()));

        with_key_scope(KeyScope::User(1), || {
            let ReadAllEntriesResult { entries: read, finished } = read_all_entries(None, usize::MAX);
            assert!(finished);
            assert_eq!(read, entries);
            // Each entry is in the map its key belongs in
            with_map(|m| {
                assert_eq!(m.get(small_key(0)), Some(vec![0]));
                assert_eq!(m.get(default_key()), Some(vec![10]));
            });
        });
        with_key_scope(KeyScope::User(2), || {
            assert!(read_all_entries(None, usize::MAX).entries.is_empty());
        });
    }

    #[test]
    fn read_all_entries_of_an_empty_map() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        let ReadAllEntriesResult { entries, finished } = read_all_entries(None, ONE_KB);
        assert!(entries.is_empty());
        assert!(finished);
    }

    #[test]
    fn read_all_entries_without_a_small_entries_map() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init(memory_manager.get(MAIN));

        with_map_mut(|m| {
            m.insert(default_key(), vec![1]);
        });

        let ReadAllEntriesResult { entries, finished } = read_all_entries(None, ONE_KB);
        assert_eq!(entries.len(), 1);
        assert!(finished);
    }

    #[test]
    fn read_all_entries_stops_before_an_entry_which_would_exceed_max_bytes() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        // A small entry (key type 17, in the small entries map) followed by a large one (key type
        // 57, in the main map)
        let small = vec![17, 1];
        let large = vec![57, 1];
        with_map_mut(|m| {
            m.map_mut(map_class(&small)).insert(BaseKey::new(small.clone()), vec![0; 10]);
            m.map_mut(map_class(&large)).insert(BaseKey::new(large.clone()), vec![0; 100]);
        });

        let ReadAllEntriesResult { entries, finished } = read_all_entries(None, 50);
        assert_eq!(
            entries.iter().map(|(k, _)| k.clone()).collect::<Vec<_>>(),
            vec![small.clone()]
        );
        assert!(!finished);

        // The large entry is read on its own, despite being larger than the limit
        let ReadAllEntriesResult { entries, finished } = read_all_entries(Some(&small), 50);
        assert_eq!(entries.iter().map(|(k, _)| k.clone()).collect::<Vec<_>>(), vec![large]);
        assert!(finished);
    }

    const ONE_KB: usize = 1024;

    #[test]
    fn read_all_entries_reads_an_entry_larger_than_max_bytes() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));

        with_map_mut(|m| {
            m.insert(default_key(), vec![1; 100]);
        });

        let ReadAllEntriesResult { entries, finished } = read_all_entries(None, 10);
        assert_eq!(entries.len(), 1);
        assert!(finished);
    }

    fn small_key(i: u32) -> TestSmallEntriesKey {
        TestSmallEntriesKeyPrefix::new().create_key(&i)
    }

    fn default_key() -> PrincipalKey {
        PrincipalKeyPrefix::new_for_principal_to_user_id_map().create_key(&Principal::anonymous())
    }

    fn suffix(key: &TestSmallEntriesKey) -> u32 {
        u32::from_be_bytes(BaseKey::from(key.clone()).as_slice()[1..].try_into().unwrap())
    }

    // A v2 map header is the magic "BTR", the layout version, then the page size as a
    // little-endian u32
    fn page_size(memory: &Memory) -> u32 {
        let mut header = [0; 8];
        memory.read(0, &mut header);
        assert_eq!(&header[..4], b"BTR\x02");
        u32::from_le_bytes(header[4..8].try_into().unwrap())
    }
}
