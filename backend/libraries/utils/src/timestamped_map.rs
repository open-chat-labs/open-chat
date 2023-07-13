use serde::{Deserialize, Serialize};
use std::collections::btree_map::Entry::Occupied;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::hash::Hash;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct TimestampedMap<K: Hash + Eq, V> {
    map: HashMap<K, ValueLastUpdated<V>>,
    by_last_updated: BTreeMap<TimestampMillis, HashSet<K>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ValueLastUpdated<V> {
    pub value: V,
    pub last_updated: TimestampMillis,
}

impl<K: Eq + Hash + Clone, V> TimestampedMap<K, V> {
    pub fn get(&self, key: &K) -> Option<&ValueLastUpdated<V>> {
        self.map.get(key)
    }

    pub fn insert(&mut self, key: K, value: V, now: TimestampMillis) {
        if let Some(previous) = self.map.remove(&key) {
            if let Occupied(mut e) = self.by_last_updated.entry(previous.last_updated) {
                let keys = e.get_mut();
                if keys.remove(&key) && keys.is_empty() {
                    e.remove();
                }
            }
        }

        self.by_last_updated.entry(now).or_default().insert(key.clone());

        self.map.insert(
            key,
            ValueLastUpdated {
                value,
                last_updated: now,
            },
        );
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = (&K, &ValueLastUpdated<V>)> {
        self.by_last_updated
            .iter()
            .rev()
            .take_while(move |(&k, _)| k > since)
            .flat_map(|(_, v)| v.iter())
            .filter_map(|k| self.map.get(k).map(|v| (k, v)))
    }

    pub fn last_updated(&self) -> Option<TimestampMillis> {
        self.by_last_updated.keys().next_back().copied()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&K, &ValueLastUpdated<V>)> {
        self.map.iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_duplicate() {
        let mut map = TimestampedMap::default();

        map.insert(1, 2, 3);
        assert_eq!(map.map.len(), 1);
        assert_eq!(map.by_last_updated.len(), 1);

        map.insert(1, 4, 5);
        assert_eq!(map.map.len(), 1);
        assert_eq!(map.by_last_updated.len(), 1);

        let result = map.get(&1).unwrap();
        assert_eq!(result.value, 4);
        assert_eq!(result.last_updated, 5);
    }

    #[test]
    fn updated_since() {
        let mut map = TimestampedMap::default();

        for i in 0..100 {
            map.insert(i, i, i);
        }

        assert_eq!(map.map.len(), 100);
        assert_eq!(map.by_last_updated.len(), 100);

        let results: Vec<_> = map.updated_since(90).map(|(i, _)| *i).collect();
        let expected: Vec<TimestampMillis> = (91..100).rev().collect();

        assert_eq!(results, expected);
    }
}
