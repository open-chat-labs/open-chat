use crate::types::indexed_event::IndexedEvent;
use candid::CandidType;
use serde::Deserialize;
use std::cmp::{max, min};
use std::collections::VecDeque;

const MAX_EVENTS: usize = 100_000;

#[derive(CandidType, Deserialize)]
pub struct EventStream<T: CandidType + Clone> {
    events: VecDeque<IndexedEvent<T>>,
}

impl<T: CandidType + Clone> EventStream<T> {
    pub fn get(&self, from_event_index: u64, max_events: u32) -> Vec<IndexedEvent<T>> {
        if let Some(earliest_event_index) = self.events.front().map(|e| e.index) {
            let latest_event_index = self.events.back().unwrap().index;
            if from_event_index > latest_event_index {
                return Vec::new();
            }

            let from_event_index = max(from_event_index, earliest_event_index);

            let start_index = (from_event_index - earliest_event_index) as usize;
            let end_index = min(start_index + (max_events as usize), self.events.len());

            (start_index..end_index).filter_map(|i| self.events.get(i)).cloned().collect()
        } else {
            Vec::new()
        }
    }

    pub fn add(&mut self, event: T) -> u64 {
        let event_index = self.events.back().map(|e| e.index + 1).unwrap_or(1);
        self.events.push_back(IndexedEvent {
            index: event_index,
            value: event,
        });

        while self.events.len() > MAX_EVENTS {
            self.events.pop_front();
        }

        event_index
    }

    pub fn remove(&mut self, up_to_event_index: u64) -> u32 {
        if let Some(earliest_event_index) = self.events.front().map(|e| e.index) {
            if earliest_event_index <= up_to_event_index {
                let count_to_remove = (up_to_event_index + 1 - earliest_event_index) as usize;

                return self.events.drain(0..count_to_remove).len() as u32;
            }
        }
        0
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
}

impl<T: CandidType + Clone> Default for EventStream<T> {
    fn default() -> Self {
        Self {
            events: VecDeque::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add() {
        let mut events_collection: EventStream<u32> = EventStream::default();

        for i in 0..10 {
            events_collection.add(i);
        }

        assert_eq!(events_collection.events.len(), 10);

        for i in 0..10 {
            let indexed_event = &events_collection.events[i];
            assert_eq!(indexed_event.index, i as u64);
            assert_eq!(indexed_event.value, i as u32);
        }
    }

    #[test]
    fn get_from_start() {
        let mut events_collection: EventStream<u32> = EventStream::default();

        for i in 0..10 {
            events_collection.add(i);
        }

        let events = events_collection.get(0, 5);

        assert_eq!(events.len(), 5);

        for i in 0..5 {
            let indexed_event = &events[i];
            assert_eq!(indexed_event.index, i as u64);
            assert_eq!(indexed_event.value, i as u32);
        }
    }

    #[test]
    fn get_with_offset() {
        let mut events_collection: EventStream<u32> = EventStream::default();

        for i in 0..10 {
            events_collection.add(i);
        }

        let events = events_collection.get(5, 5);

        assert_eq!(events.len(), 5);

        for i in 5..10 {
            let indexed_event = &events[i - 5];
            assert_eq!(indexed_event.index, i as u64);
            assert_eq!(indexed_event.value, i as u32);
        }
    }

    #[test]
    fn get_with_request_exceeding_data_range() {
        let mut events_collection: EventStream<u32> = EventStream::default();

        for i in 0..10 {
            events_collection.add(i);
        }

        let events = events_collection.get(5, 10);

        assert_eq!(events.len(), 5);

        for i in 5..10 {
            let indexed_event = &events[i - 5];
            assert_eq!(indexed_event.index, i as u64);
            assert_eq!(indexed_event.value, i as u32);
        }
    }

    #[test]
    fn remove() {
        let mut events_collection: EventStream<u32> = EventStream::default();

        for i in 0..10 {
            events_collection.add(i);
        }

        assert_eq!(events_collection.remove(4), 5);

        let events = events_collection.get(0, 5);

        assert_eq!(events.len(), 5);

        for i in 5..10 {
            let indexed_event = &events[i - 5];
            assert_eq!(indexed_event.index, i as u64);
            assert_eq!(indexed_event.value, i as u32);
        }

        assert_eq!(events_collection.remove(4), 0);
        assert_eq!(events_collection.remove(9), 5);
        assert!(events_collection.events.is_empty());
    }
}
