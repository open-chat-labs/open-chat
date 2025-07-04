use std::cmp::{Ordering, Reverse};
use std::collections::{BTreeMap, BinaryHeap};
use std::iter::Iterator;
use std::vec::IntoIter;

impl<I: Iterator> IteratorExtensions for I {}

pub trait IteratorExtensions: Iterator {
    fn max_n_by<K, F>(self, count: usize, key_fn: F) -> IntoIter<Self::Item>
    where
        Self: Sized,
        K: Ord,
        F: Fn(&Self::Item) -> K,
    {
        self.min_n_by(count, |i| Reverse(key_fn(i)))
    }

    fn min_n_by<K, F>(self, count: usize, key_fn: F) -> IntoIter<Self::Item>
    where
        Self: Sized,
        K: Ord,
        F: Fn(&Self::Item) -> K,
    {
        let mut top = BinaryHeap::with_capacity(count);

        let mut iter = self.map(|i| ItemWithSortKey {
            sort_key: key_fn(&i),
            item: i,
        });

        // First fill the heap with 'count' values
        for item in iter.by_ref().take(count) {
            top.push(item);
        }

        // Then as we add each item, pop the max
        for item in iter {
            top.push(item);
            top.pop();
        }

        // Return the items in ascending order
        let vec: Vec<_> = top.into_sorted_vec().into_iter().map(|g| g.item).collect();
        vec.into_iter()
    }

    fn count_per_value(self) -> BTreeMap<Self::Item, u32>
    where
        Self: Sized,
        Self::Item: Ord + PartialOrd + Eq + PartialEq,
    {
        let mut map = BTreeMap::new();
        for item in self {
            *map.entry(item).or_default() += 1;
        }
        map
    }
}

struct ItemWithSortKey<V, K: Ord + PartialEq> {
    item: V,
    sort_key: K,
}

impl<V, K: Ord> Eq for ItemWithSortKey<V, K> {}

impl<V, K: Ord> PartialEq<Self> for ItemWithSortKey<V, K> {
    fn eq(&self, other: &Self) -> bool {
        self.sort_key.eq(&other.sort_key)
    }
}

impl<V, K: Ord> PartialOrd<Self> for ItemWithSortKey<V, K> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<V, K: Ord> Ord for ItemWithSortKey<V, K> {
    fn cmp(&self, other: &Self) -> Ordering {
        self.sort_key.cmp(&other.sort_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;

    #[test]
    fn max_n_by() {
        let mut rng = rand::thread_rng();

        let input: Vec<_> = (0..100).map(|_| rng.next_u32()).collect();

        let max: Vec<_> = input.iter().cloned().max_n_by(10, |i| *i).collect();

        let mut max_original: Vec<_> = input;
        max_original.sort();
        max_original.reverse();
        max_original.truncate(10);

        assert_eq!(max, max_original);
    }

    #[test]
    fn min_n_by() {
        let mut rng = rand::thread_rng();

        let input: Vec<_> = (0..100).map(|_| rng.next_u32()).collect();

        let min: Vec<_> = input.iter().cloned().min_n_by(10, |i| *i).collect();

        let mut min_original: Vec<_> = input;
        min_original.sort();
        min_original.truncate(10);

        assert_eq!(min, min_original);
    }
}
