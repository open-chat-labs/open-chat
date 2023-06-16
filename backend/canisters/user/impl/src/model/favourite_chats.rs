use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{Chat, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize, Default)]
pub struct FavouriteChats {
    chats: Timestamped<HashSet<Chat>>,
    pinned: Timestamped<Vec<Chat>>,
}

impl FavouriteChats {
    pub fn add(&mut self, chat: Chat, now: TimestampMillis) -> bool {
        self.chats.timestamp = now;
        self.chats.value.insert(chat)
    }

    pub fn remove(&mut self, chat: Chat, now: TimestampMillis) -> bool {
        self.unpin(&chat, now);
        self.chats.timestamp = now;
        self.chats.value.remove(&chat)
    }

    pub fn pin(&mut self, chat: Chat, now: TimestampMillis) -> bool {
        if !self.chats.value.contains(&chat) {
            self.pinned.timestamp = now;
            self.pinned.value.insert(0, chat);
            self.chats.value.insert(chat);
            true
        } else {
            false
        }
    }

    pub fn unpin(&mut self, chat: &Chat, now: TimestampMillis) -> bool {
        if self.pinned.value.contains(chat) {
            self.pinned.timestamp = now;
            self.pinned.value.retain(|pinned_chat| pinned_chat != chat);
            true
        } else {
            false
        }
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.chats.timestamp > since || self.pinned.timestamp > since
    }

    pub fn chats(&self) -> &HashSet<Chat> {
        &self.chats.value
    }

    pub fn pinned(&self) -> &Vec<Chat> {
        &self.pinned.value
    }

    pub fn chats_if_updated(&self, since: TimestampMillis) -> Option<Vec<Chat>> {
        self.chats.if_set_after(since).map(|ids| ids.iter().copied().collect())
    }

    pub fn pinned_if_updated(&self, since: TimestampMillis) -> Option<Vec<Chat>> {
        self.pinned.if_set_after(since).map(|ids| ids.to_vec())
    }
}
