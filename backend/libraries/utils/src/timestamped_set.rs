use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::hash::Hash;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Clone)]
pub struct TimestampedSet<T: Hash + Ord> {
    map: HashMap<T, TimestampMillis>,
    by_last_updated: BTreeSet<(TimestampMillis, T)>,
}

impl<T: Hash + Ord> TimestampedSet<T> {
    pub fn new() -> TimestampedSet<T> {
        TimestampedSet {
            map: HashMap::new(),
            by_last_updated: BTreeSet::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }
}

impl<T: Hash + Ord + Clone> TimestampedSet<T> {
    pub fn get(&self, value: &T) -> Option<TimestampMillis> {
        self.map.get(value).copied()
    }

    pub fn insert(&mut self, value: T, timestamp: TimestampMillis) {
        self.remove(value.clone());
        self.by_last_updated.insert((timestamp, value.clone()));
        self.map.insert(value, timestamp);
    }

    pub fn remove(&mut self, value: T) -> Option<TimestampMillis> {
        if let Some(ts) = self.map.remove(&value) {
            self.by_last_updated.remove(&(ts, value));
            Some(ts)
        } else {
            None
        }
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = (&T, TimestampMillis)> {
        self.by_last_updated.iter().map(|(ts, v)| (v, *ts))
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = (&T, TimestampMillis)> {
        self.by_last_updated
            .iter()
            .rev()
            .take_while(move |(k, _)| *k > since)
            .map(|(k, v)| (v, *k))
    }

    pub fn last_updated(&self) -> Option<TimestampMillis> {
        self.by_last_updated.iter().next_back().map(|(ts, _)| *ts)
    }
}

impl<T: Hash + Ord + Clone> FromIterator<(T, TimestampMillis)> for TimestampedSet<T> {
    fn from_iter<I: IntoIterator<Item = (T, TimestampMillis)>>(iter: I) -> Self {
        let mut set = TimestampedSet::default();
        for (value, timestamp) in iter {
            set.insert(value, timestamp);
        }
        set
    }
}

impl<T: Hash + Ord> Default for TimestampedSet<T> {
    fn default() -> Self {
        TimestampedSet::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_duplicate() {
        let mut set = TimestampedSet::default();

        set.insert(1, 2);
        assert_eq!(set.map.len(), 1);
        assert_eq!(set.by_last_updated.len(), 1);

        set.insert(1, 4);
        assert_eq!(set.map.len(), 1);
        assert_eq!(set.by_last_updated.len(), 1);

        assert_eq!(set.get(&1).unwrap(), 4);
    }

    #[test]
    fn updated_since() {
        let mut set = TimestampedSet::default();

        for i in 0..100 {
            set.insert(i, i);
        }

        assert_eq!(set.map.len(), 100);
        assert_eq!(set.by_last_updated.len(), 100);

        let results: Vec<_> = set.updated_since(90).map(|(i, _)| *i).collect();
        let expected: Vec<TimestampMillis> = (91..100).rev().collect();

        assert_eq!(results, expected);
    }
}
