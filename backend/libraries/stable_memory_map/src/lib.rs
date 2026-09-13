//! If you want to store data in this map and be able to iterate over it in order, then the keys
//! must maintain their ordering when represented as bytes, since the keys in the map are ordered
//! by their bytes.

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::{Cell, OnceCell, RefCell};
use std::marker::PhantomData;
use std::ops::{Bound, RangeBounds};

mod keys;

pub use keys::*;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

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
    init_inner(memory, None);
}

pub fn init_with_small_entries_map(memory: Memory, small_entries_memory: Memory) {
    init_inner(
        memory,
        Some(Map::init_with_page_size(small_entries_memory, SMALL_ENTRIES_MAP_PAGE_SIZE)),
    );
}

fn init_inner(memory: Memory, small_entries_map: Option<Map>) {
    let map = Map::init(memory);

    // Guards against a key type's class being changed after data has been stored under it, which
    // would otherwise leave that data in a map where it would never be found
    for key_type in KeyType::all().filter(|kt| kt.map_class() == MapClass::SmallEntries) {
        let prefix = BaseKeyPrefix::from_key_type(key_type);
        let found = map
            .range(BaseKey::from(prefix.clone())..)
            .next()
            .is_some_and(|e| e.key().matches_prefix(&prefix));

        assert!(
            !found,
            "Found entries for {key_type:?} in the main map, but it is in the small entries map"
        );
    }

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

    fn remove(&mut self, key: &KeyPrefix::Suffix) -> Option<LazyValue<KeyPrefix::Suffix, Value>> {
        let bytes_removed = with_map_mut(|m| m.remove(self.prefix().create_key(key)))?;

        let key_clone = key.clone();
        let removed = LazyValue::new(key_clone, bytes_removed, Self::bytes_to_value);
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
        let key = key.into();
        self.map(map_class(key.as_slice())).get(&key)
    }

    pub fn contains_key<K: Key>(&self, key: K) -> bool {
        let key = key.into();
        self.map(map_class(key.as_slice())).contains_key(&key)
    }

    pub fn insert<K: Key>(&mut self, key: K, value: Vec<u8>) -> Option<Vec<u8>> {
        let key = key.into();
        self.map_mut(map_class(key.as_slice())).insert(key, value)
    }

    // Inserts many entries, writing each modified node to stable memory at most once rather than
    // once per entry. Unlike `insert`, the previous values aren't returned. Nodes are only written
    // once the input has moved past them, so this only helps when consecutive keys are close
    // together, meaning the entries should be supplied in key order. Out of order entries are still
    // inserted correctly, but cost no less than calling `insert` for each one.
    pub fn insert_many<K: Key>(&mut self, entries: impl IntoIterator<Item = (K, Vec<u8>)>) {
        let mut entries = entries
            .into_iter()
            .map(|(key, value)| -> (BaseKey, Vec<u8>) { (key.into(), value) })
            .peekable();

        let Some((first, _)) = entries.peek() else {
            return;
        };
        let class = map_class(first.as_slice());

        self.map_mut(class).insert_many(entries.inspect(move |(key, _)| {
            assert_eq!(
                map_class(key.as_slice()),
                class,
                "Entries inserted together must be in the same map"
            );
        }));
    }

    pub fn remove<K: Key>(&mut self, key: K) -> Option<Vec<u8>> {
        let key = key.into();
        self.map_mut(map_class(key.as_slice())).remove(&key)
    }

    pub fn range<'a, K: Key + 'a, R: RangeBounds<K>>(&'a self, range: R) -> impl DoubleEndedIterator<Item = (K, Vec<u8>)> + 'a {
        let start = map_bound(range.start_bound());
        let end = map_bound(range.end_bound());
        let map = self.map(range_map_class(&start, &end));

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
    let mut total_count = 0;
    with_map_mut(|m| {
        let map = m.map_mut(map_class(prefix.as_slice()));

        // If < 2B instructions have been used so far, delete another 100 keys, or exit if complete
        while ic_cdk::api::instruction_counter() < 2_000_000_000 {
            let keys: Vec<_> = map
                .range(BaseKey::from(prefix.clone())..)
                .take_while(|e| e.key().matches_prefix(&prefix))
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
    K::try_from(key).ok().map(|k| (k, value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::test_small_entries::{TestSmallEntriesKey, TestSmallEntriesKeyPrefix};
    use ic_principal::Principal;
    use ic_stable_structures::Memory as _;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

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
    #[should_panic(expected = "Found entries for TestSmallEntries in the main map")]
    fn init_panics_if_main_map_contains_small_entries() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        let mut map = Map::init(memory_manager.get(MAIN));
        map.insert(small_key(1).into(), vec![1]);
        drop(map);

        init_with_small_entries_map(memory_manager.get(MAIN), memory_manager.get(SMALL));
    }

    #[test]
    #[should_panic(expected = "Range bounds are in different maps")]
    fn range_across_maps_panics() {
        range_map_class(&Bound::Included(default_key().into()), &Bound::Excluded(small_key(1).into()));
    }

    // Moving a key type which already holds data to the other map would orphan that data, so the
    // key types which existed before the small entries map was introduced must stay in the main map
    #[test]
    fn existing_key_types_stay_in_main_map() {
        for key_type in KeyType::all().filter(|kt| (*kt as u8) <= KeyType::BlockedUsers as u8) {
            assert_eq!(key_type.map_class(), MapClass::Default, "{key_type:?}");
        }
        assert_eq!(KeyType::all().filter(|kt| kt.map_class() == MapClass::Default).count(), 16);
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
