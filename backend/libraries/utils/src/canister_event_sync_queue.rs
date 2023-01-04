use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::{
    collections::{HashMap, VecDeque},
    mem,
};
use types::CanisterId;

const MAX_CANISTERS_PER_BATCH: usize = 10;

#[derive(Serialize, Deserialize)]
pub struct CanisterEventSyncQueue<T> {
    queue: VecDeque<CanisterId>,
    sync_in_progress: bool,
    events: HashMap<CanisterId, Vec<T>>,
}

impl<T> Default for CanisterEventSyncQueue<T> {
    fn default() -> CanisterEventSyncQueue<T> {
        CanisterEventSyncQueue {
            queue: VecDeque::default(),
            sync_in_progress: false,
            events: HashMap::default(),
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

    pub fn try_start_sync(&mut self) -> Option<Vec<(CanisterId, Vec<T>)>> {
        if self.sync_in_progress || self.queue.is_empty() {
            None
        } else {
            self.sync_in_progress = true;
            let canisters = if self.queue.len() <= MAX_CANISTERS_PER_BATCH {
                mem::take(&mut self.queue)
            } else {
                self.queue.drain(..MAX_CANISTERS_PER_BATCH).collect()
            };

            let mut results = Vec::new();
            for canister_id in canisters {
                if let Some(events) = self.events.remove(&canister_id).filter(|events| !events.is_empty()) {
                    results.push((canister_id, events));
                }
            }

            Some(results)
        }
    }

    pub fn mark_sync_completed(&mut self) {
        self.sync_in_progress = false;
    }

    pub fn mark_sync_failed(&mut self, canister_id: CanisterId, events: Vec<T>) {
        let merged_events = match self.events.remove_entry(&canister_id) {
            Some((_, old_events)) => events.into_iter().chain(old_events).collect(),
            None => {
                self.queue.push_back(canister_id);
                events
            }
        };

        self.events.insert(canister_id, merged_events);

        self.sync_in_progress = false;
    }
}
