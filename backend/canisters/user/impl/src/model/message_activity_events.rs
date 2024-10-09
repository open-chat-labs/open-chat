use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::TimestampMillis;
use user_canister::{MessageActivityEvent, MessageActivitySummary};

#[derive(Serialize, Deserialize, Default)]
pub struct MessageActivityEvents {
    events: VecDeque<MessageActivityEvent>,
    read_up_to: TimestampMillis,
    last_updated: TimestampMillis,
}

impl MessageActivityEvents {
    const MAX_EVENTS: usize = 1000;

    pub fn push(&mut self, event: MessageActivityEvent, now: TimestampMillis) {
        if let Some(matching_index) = self.events.iter().position(|e| event.matches(e)) {
            // Remove any matching event action
            self.events.remove(matching_index);
        } else if self.events.len() > MessageActivityEvents::MAX_EVENTS - 1 {
            // Keep no more than MAX_EVENTS
            self.events.pop_back();
        }

        // Ensure events are ordered by timestamp - in general the event will be inserted at the front
        if let Some(index) = self.events.iter().position(|e| event.timestamp >= e.timestamp) {
            self.events.insert(index, event);
        } else {
            self.events.push_back(event);
        }

        self.last_updated = now;
    }

    pub fn mark_read_up_to(&mut self, read_up_to: TimestampMillis, now: TimestampMillis) {
        self.read_up_to = read_up_to;
        self.last_updated = now;
    }

    pub fn summary(&self) -> MessageActivitySummary {
        let unread_count = self.events.iter().take_while(|e| e.timestamp > self.read_up_to).count() as u32;

        MessageActivitySummary {
            read_up_to: self.read_up_to,
            unread_count,
            latest_event: self.events.front().map_or(0, |e| e.timestamp),
        }
    }

    pub fn latest_events(&self, since: TimestampMillis, max: u32) -> Vec<MessageActivityEvent> {
        self.events
            .iter()
            .take(max as usize)
            .take_while(|e| e.timestamp > since)
            .cloned()
            .collect()
    }

    pub fn len(&self) -> u32 {
        self.events.len() as u32
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }
}
