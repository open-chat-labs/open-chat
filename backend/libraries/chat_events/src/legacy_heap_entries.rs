use serde::de::{IgnoredAny, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer};
use std::fmt::Formatter;

// The entries of a list or map which a chat used to hold on the heap, before they were moved into
// stable memory. Every chat has long since been migrated, so they're only read to be counted, and
// are never kept or written again, so that a canister still holding any refuses to upgrade (see
// `ChatEvents::legacy_heap_entries`). This can be removed once every canister has been upgraded.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(crate) struct LegacyHeapEntries(usize);

impl LegacyHeapEntries {
    pub(crate) fn count(&self) -> usize {
        self.0
    }
}

impl<'de> Deserialize<'de> for LegacyHeapEntries {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(LegacyHeapEntriesVisitor)
    }
}

struct LegacyHeapEntriesVisitor;

impl<'de> Visitor<'de> for LegacyHeapEntriesVisitor {
    type Value = LegacyHeapEntries;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a list or a map")
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E> {
        Ok(LegacyHeapEntries(0))
    }

    fn visit_none<E>(self) -> Result<Self::Value, E> {
        Ok(LegacyHeapEntries(0))
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
        let mut count = 0;
        while seq.next_element::<IgnoredAny>()?.is_some() {
            count += 1;
        }
        Ok(LegacyHeapEntries(count))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        let mut count = 0;
        while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {
            count += 1;
        }
        Ok(LegacyHeapEntries(count))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Serialize;
    use std::collections::{BTreeMap, BTreeSet, HashMap};

    #[derive(Serialize)]
    struct Before {
        set: BTreeSet<(u64, u32)>,
        map: BTreeMap<u32, (u64, String)>,
        hash_map: HashMap<u64, u32>,
        empty: Vec<u32>,
        kept: u32,
    }

    #[derive(Deserialize)]
    struct After {
        set: LegacyHeapEntries,
        map: LegacyHeapEntries,
        hash_map: LegacyHeapEntries,
        empty: LegacyHeapEntries,
        #[serde(default)]
        missing: LegacyHeapEntries,
        kept: u32,
    }

    #[test]
    fn entries_of_lists_and_maps_are_counted() {
        let before = Before {
            set: BTreeSet::from([(1, 2), (3, 4)]),
            map: BTreeMap::from([
                (1, (2, "a".to_string())),
                (3, (4, "b".to_string())),
                (5, (6, "c".to_string())),
            ]),
            hash_map: HashMap::from([(1, 2)]),
            empty: Vec::new(),
            kept: 7,
        };
        let bytes = msgpack::serialize_then_unwrap(&before);
        let after: After = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(after.set.count(), 2);
        assert_eq!(after.map.count(), 3);
        assert_eq!(after.hash_map.count(), 1);
        assert_eq!(after.empty.count(), 0);
        assert_eq!(after.missing.count(), 0);
        assert_eq!(after.kept, 7);
    }
}
