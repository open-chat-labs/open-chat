use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::{
    collections::{HashMap, VecDeque},
    mem,
};
use types::{UserEvent, UserId};

const MAX_USERS_PER_BATCH: usize = 5;

#[derive(Serialize, Deserialize, Default)]
pub struct UserEventSyncQueue {
    queue: VecDeque<UserId>,
    sync_in_progress: bool,
    user_events: HashMap<UserId, Vec<UserEvent>>,
}

impl UserEventSyncQueue {
    pub fn push(&mut self, user_id: UserId, event: UserEvent) {
        match self.user_events.entry(user_id) {
            Vacant(e) => {
                self.queue.push_back(user_id);
                e.insert(vec![event]);
            }
            Occupied(e) => {
                e.into_mut().push(event);
            }
        }
    }

    pub fn try_start_sync(&mut self) -> Option<Vec<(UserId, Vec<UserEvent>)>> {
        if self.sync_in_progress || self.queue.is_empty() {
            None
        } else {
            self.sync_in_progress = true;
            let users = if self.queue.len() <= MAX_USERS_PER_BATCH {
                mem::take(&mut self.queue)
            } else {
                self.queue.drain(..MAX_USERS_PER_BATCH).collect()
            };

            let mut results = Vec::new();
            for user_id in users {
                if let Some(events) = self.user_events.remove(&user_id).filter(|events| !events.is_empty()) {
                    results.push((user_id, events));
                }
            }

            Some(results)
        }
    }

    pub fn mark_sync_completed(&mut self) {
        self.sync_in_progress = false;
    }

    pub fn mark_sync_failed(&mut self, user_id: UserId, events: Vec<UserEvent>) {
        let merged_events = match self.user_events.remove_entry(&user_id) {
            Some((_, old_events)) => events.into_iter().chain(old_events).collect(),
            None => {
                self.queue.push_back(user_id);
                events
            }
        };

        self.user_events.insert(user_id, merged_events);

        self.sync_in_progress = false;
    }
}
