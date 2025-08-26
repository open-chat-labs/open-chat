use serde::{Deserialize, Serialize};
use std::{cmp::Reverse, collections::BinaryHeap};

#[derive(Serialize, Deserialize)]
pub struct MinBinaryHeap<T: Ord> {
    heap: BinaryHeap<Reverse<T>>,
}

impl<T: Ord> Default for MinBinaryHeap<T> {
    fn default() -> MinBinaryHeap<T> {
        MinBinaryHeap {
            heap: BinaryHeap::default(),
        }
    }
}

impl<T: Ord> MinBinaryHeap<T> {
    pub fn new() -> MinBinaryHeap<T> {
        MinBinaryHeap::default()
    }

    pub fn push(&mut self, item: T) {
        self.heap.push(Reverse(item));
    }

    pub fn pop(&mut self) -> Option<T> {
        self.heap.pop().map(|e| e.0)
    }

    pub fn retain<F>(&mut self, mut f: F)
    where
        F: FnMut(&T) -> bool,
    {
        self.heap.retain(|e| f(&e.0));
    }

    pub fn drain(&mut self) -> impl Iterator<Item = T> + '_ {
        self.heap.drain().map(|e| e.0)
    }

    pub fn peek(&self) -> Option<&T> {
        self.heap.peek().map(|e| &e.0)
    }
}
