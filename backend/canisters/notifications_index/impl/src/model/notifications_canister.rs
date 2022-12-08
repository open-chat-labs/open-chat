use notifications_index_canister::NotificationsIndexEvent;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{TimestampMillis, Version};

#[derive(Serialize, Deserialize, Default)]
pub struct NotificationsCanister {
    wasm_version: Version,
    events_queue: VecDeque<NotificationsIndexEvent>,
    sync_in_progress: Option<TimestampMillis>,
}

impl NotificationsCanister {
    pub fn new(wasm_version: Version) -> NotificationsCanister {
        NotificationsCanister {
            wasm_version,
            events_queue: VecDeque::default(),
            sync_in_progress: None,
        }
    }

    pub fn queue_len(&self) -> usize {
        self.events_queue.len()
    }

    pub fn sync_in_progress(&self) -> bool {
        self.sync_in_progress.is_some()
    }

    pub fn mark_sync_in_progress(&mut self, now: TimestampMillis) {
        self.sync_in_progress = Some(now);
    }

    pub fn mark_sync_complete(&mut self) {
        self.sync_in_progress = None;
    }

    pub fn take_next(&mut self) -> Option<NotificationsIndexEvent> {
        self.events_queue.pop_front()
    }

    pub fn enqueue_event(&mut self, event: NotificationsIndexEvent) {
        self.events_queue.push_back(event);
    }

    pub fn enqueue_event_front(&mut self, event: NotificationsIndexEvent) {
        self.events_queue.push_front(event);
    }
}
