use serde::{Deserialize, Serialize};
use std::cmp::min;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, VecDeque};
use types::CanisterId;

#[derive(Serialize, Deserialize)]
pub struct CanisterEventSyncQueue<T> {
    queue: VecDeque<CanisterId>,
    sync_in_progress: bool,
    events: HashMap<CanisterId, Vec<T>>,
    max_canisters_per_batch: usize,
    max_events_per_canister_per_batch: usize,
}

impl<T> Default for CanisterEventSyncQueue<T> {
    fn default() -> CanisterEventSyncQueue<T> {
        CanisterEventSyncQueue {
            queue: VecDeque::default(),
            sync_in_progress: false,
            events: HashMap::default(),
            max_canisters_per_batch: 10,
            max_events_per_canister_per_batch: 1000,
        }
    }
}

impl<T> CanisterEventSyncQueue<T> {
    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn sync_in_progress(&self) -> bool {
        self.sync_in_progress
    }

    pub fn push(&mut self, canister_id: CanisterId, event: T) {
        match self.events.entry(canister_id) {
            Vacant(e) => {
                self.queue.push_back(canister_id);
                e.insert(vec![event]);
            }
            Occupied(e) => {
                e.into_mut().push(event);
            }
        }
    }

    pub fn try_start_single(&mut self) -> Option<(CanisterId, Vec<T>)> {
        if self.sync_in_progress {
            return None;
        }

        let canister_id = self.queue.pop_front()?;
        if let Some((events, has_more_events)) = self.take_events(canister_id) {
            self.sync_in_progress = true;
            if has_more_events {
                self.queue.push_back(canister_id);
            }
            Some((canister_id, events))
        } else {
            None
        }
    }

    pub fn try_start_batch(&mut self) -> Option<Vec<(CanisterId, Vec<T>)>> {
        if self.sync_in_progress || self.queue.is_empty() {
            None
        } else {
            let mut batch = Vec::new();
            let mut canisters_to_readd = Vec::new();
            while let Some(canister_id) = self.queue.pop_front() {
                if let Some((events, has_more_events)) = self.take_events(canister_id) {
                    if has_more_events {
                        // If there are more events, queue up the canister to be processed again
                        canisters_to_readd.push(canister_id);
                    }
                    batch.push((canister_id, events));
                    if batch.len() >= self.max_canisters_per_batch {
                        break;
                    }
                }
            }
            for canister_id in canisters_to_readd {
                self.queue.push_back(canister_id);
            }
            if batch.is_empty() {
                None
            } else {
                self.sync_in_progress = true;
                Some(batch)
            }
        }
    }

    pub fn mark_batch_completed(&mut self) {
        self.sync_in_progress = false;
    }

    pub fn mark_sync_failed_for_canister(&mut self, canister_id: CanisterId, events: Vec<T>) {
        let merged_events = match self.events.remove_entry(&canister_id) {
            Some((_, old_events)) => events.into_iter().chain(old_events).collect(),
            None => {
                self.queue.push_back(canister_id);
                events
            }
        };

        self.events.insert(canister_id, merged_events);
    }

    fn take_events(&mut self, canister_id: CanisterId) -> Option<(Vec<T>, bool)> {
        if let Occupied(mut e) = self.events.entry(canister_id) {
            let vec = e.get_mut();
            let count = min(vec.len(), self.max_events_per_canister_per_batch);
            if count == 0 {
                return None;
            }

            let mut items = Vec::with_capacity(count);
            for item in vec.drain(..count) {
                items.push(item);
            }

            let has_more_events = !vec.is_empty();
            if !has_more_events {
                // If there are no more events, remove the entry from the map
                e.remove();
            }

            Some((items, has_more_events))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_canister() {
        let mut queue = CanisterEventSyncQueue {
            max_canisters_per_batch: 2,
            max_events_per_canister_per_batch: 5,
            ..Default::default()
        };

        let canister_id = CanisterId::from_slice(&[1]);

        for i in 0..11 {
            queue.push(canister_id, i);
        }

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 1);
        assert_eq!(batch[0].0, canister_id);
        assert_eq!(batch[0].1, vec![0, 1, 2, 3, 4]);
        queue.mark_batch_completed();

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 1);
        assert_eq!(batch[0].0, canister_id);
        assert_eq!(batch[0].1, vec![5, 6, 7, 8, 9]);
        queue.mark_batch_completed();

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 1);
        assert_eq!(batch[0].0, canister_id);
        assert_eq!(batch[0].1, vec![10]);
        queue.mark_batch_completed();

        assert!(queue.try_start_batch().is_none());
    }

    #[test]
    fn canister_count_lower_than_batch_size() {
        let mut queue = CanisterEventSyncQueue {
            max_canisters_per_batch: 3,
            max_events_per_canister_per_batch: 5,
            ..Default::default()
        };

        let canister_id1 = CanisterId::from_slice(&[1]);
        let canister_id2 = CanisterId::from_slice(&[2]);

        for i in 0..11 {
            queue.push(canister_id1, i);
        }

        for i in 0..8 {
            queue.push(canister_id2, i);
        }

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch[0].0, canister_id1);
        assert_eq!(batch[0].1, vec![0, 1, 2, 3, 4]);
        assert_eq!(batch[1].0, canister_id2);
        assert_eq!(batch[1].1, vec![0, 1, 2, 3, 4]);
        queue.mark_batch_completed();

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch[0].0, canister_id1);
        assert_eq!(batch[0].1, vec![5, 6, 7, 8, 9]);
        assert_eq!(batch[1].0, canister_id2);
        assert_eq!(batch[1].1, vec![5, 6, 7]);
        queue.mark_batch_completed();

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 1);
        assert_eq!(batch[0].0, canister_id1);
        assert_eq!(batch[0].1, vec![10]);
        queue.mark_batch_completed();

        assert!(queue.try_start_batch().is_none());
    }

    #[test]
    fn canister_count_exceeds_batch_size() {
        let mut queue = CanisterEventSyncQueue {
            max_canisters_per_batch: 2,
            max_events_per_canister_per_batch: 5,
            ..Default::default()
        };

        let canister_id1 = CanisterId::from_slice(&[1]);
        let canister_id2 = CanisterId::from_slice(&[2]);
        let canister_id3 = CanisterId::from_slice(&[3]);

        for i in 0..11 {
            queue.push(canister_id1, i);
        }

        for i in 0..8 {
            queue.push(canister_id2, i);
        }

        queue.push(canister_id3, 0);

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch[0].0, canister_id1);
        assert_eq!(batch[0].1, vec![0, 1, 2, 3, 4]);
        assert_eq!(batch[1].0, canister_id2);
        assert_eq!(batch[1].1, vec![0, 1, 2, 3, 4]);
        queue.mark_batch_completed();

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch[0].0, canister_id3);
        assert_eq!(batch[0].1, vec![0]);
        assert_eq!(batch[1].0, canister_id1);
        assert_eq!(batch[1].1, vec![5, 6, 7, 8, 9]);
        queue.mark_batch_completed();

        let batch = queue.try_start_batch().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch[0].0, canister_id2);
        assert_eq!(batch[0].1, vec![5, 6, 7]);
        assert_eq!(batch[1].0, canister_id1);
        assert_eq!(batch[1].1, vec![10]);
        queue.mark_batch_completed();

        assert!(queue.try_start_batch().is_none());
    }
}
