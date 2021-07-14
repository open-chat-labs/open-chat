use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;
use shared::types::message_content::MessageContent;
use shared::types::{MessageIndex, UserId};
use std::cmp::{max, min};
use std::collections::VecDeque;

const MAX_EVENTS: usize = 100_000;

#[derive(CandidType, Deserialize, Default)]
pub struct Events {
    events: VecDeque<IndexedEvent>,
}

impl Events {
    pub fn get(&self, from_event_index: u64, max_events: u32) -> Vec<IndexedEvent> {
        if let Some(earliest_event_index) = self.events.front().map(|e| e.index) {
            let latest_event_index = self.events.back().unwrap().index;
            if from_event_index > latest_event_index {
                return Vec::new();
            }

            let from_event_index = max(from_event_index, earliest_event_index);

            let start_index = (from_event_index - earliest_event_index) as usize;
            let end_index = min(start_index + (max_events as usize), self.events.len());

            (start_index..=end_index)
                .filter_map(|i| self.events.get(i))
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn add(&mut self, event: Event) -> u64 {
        let event_index = self.events.back().map(|e| e.index).unwrap_or(0) + 1;
        self.events.push_back(IndexedEvent {
            index: event_index,
            event,
        });

        while self.events.len() > MAX_EVENTS {
            self.events.pop_front();
        }

        event_index
    }

    pub fn remove(&mut self, up_to_event_index: u64) {
        if let Some(earliest_event_index) = self.events.front().map(|e| e.index) {
            if earliest_event_index <= up_to_event_index {
                let count_to_remove = (up_to_event_index - earliest_event_index) as usize;

                self.events.drain(0..count_to_remove);
            }
        }
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct IndexedEvent {
    index: u64,
    event: Event,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum Event {
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
    Subscription(Subscription),
}

#[derive(CandidType, Deserialize, Clone)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub recipient: UserId,
    pub message_index: MessageIndex,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct GroupMessageNotification {
    pub chat_id: GroupChatId,
    pub sender: UserId,
    pub recipients: Vec<UserId>,
    pub message_index: MessageIndex,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Subscription {
    pub user_id: UserId,
    pub subscription: String,
}
