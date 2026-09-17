use direct_chat_core::{DirectChatEntry, removed_chats};
use serde::{Deserialize, Serialize};
use stable_memory_map::RemovedChatKeyPrefix;
use std::cmp::Reverse;
use std::collections::HashMap;
use types::{Chat, ChatId, TimestampMillis, Timestamped};

// The direct chats of one user, keyed by the other user's id as in the User canister. Each is the
// user's entry for the chat, whose core lives outside of any user in the `DirectChatCores` held by
// the canister, since a chat between two users of this canister has a single core shared by both
// of their entries.
//
// The chats the user has removed are recorded in the stable memory map, so the methods which read
// or write those records must run within the user's key scope, which they do when reached via
// `Users::with_user` and `Users::with_user_mut`.
#[derive(Serialize, Deserialize, Default)]
pub struct UserDirectChats {
    chats: HashMap<ChatId, DirectChatEntry>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
}

impl UserDirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChatEntry> {
        self.chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChatEntry> {
        self.chats.get_mut(chat_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &DirectChatEntry> {
        self.chats.values()
    }

    // Panics if the user already has a chat with the same user, since replacing the entry would
    // leave that chat's core with nothing pointing at it
    pub fn add(&mut self, chat: DirectChatEntry) {
        let chat_id = chat.them.into();
        assert!(self.chats.insert(chat_id, chat).is_none(), "Direct chat already exists");
    }

    // Removes the user's entry for the chat, recording its removal so that `updates` reports it
    pub fn remove(&mut self, chat_id: &ChatId, now: TimestampMillis) -> Option<DirectChatEntry> {
        let chat = self.chats.remove(chat_id)?;
        removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), (*chat_id).into(), now);
        Some(chat)
    }

    pub fn removed_since(&self, since: TimestampMillis) -> Vec<ChatId> {
        removed_chats::removed_since(&RemovedChatKeyPrefix::new_for_direct_chats(), since)
            .into_iter()
            .map(|(_, chat_id)| chat_id.into())
            .collect()
    }

    // Whether anything held here, rather than in the chats themselves, has changed since `since`
    pub fn any_removed_or_pinned_since(&self, since: TimestampMillis) -> bool {
        self.pinned.timestamp > since || removed_chats::any_removed_since(&RemovedChatKeyPrefix::new_for_direct_chats(), since)
    }

    // The pinned chats, most recently pinned first
    pub fn pinned_chats(&self) -> Vec<Chat> {
        let mut pinned: Vec<_> = self.pinned.value.iter().map(|(chat_id, ts)| (*chat_id, *ts)).collect();
        pinned.sort_unstable_by_key(|(_, ts)| Reverse(*ts));
        pinned.into_iter().map(|(chat_id, _)| Chat::Direct(chat_id)).collect()
    }

    pub fn pinned_chats_if_updated(&self, since: TimestampMillis) -> Option<Vec<Chat>> {
        (self.pinned.timestamp > since).then(|| self.pinned_chats())
    }

    pub fn pin(&mut self, chat_id: ChatId, now: TimestampMillis) {
        if !self.pinned.value.contains_key(&chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.insert(chat_id, now);
        }
    }

    pub fn unpin(&mut self, chat_id: &ChatId, now: TimestampMillis) {
        if self.pinned.value.remove(chat_id).is_some() {
            self.pinned.timestamp = now;
        }
    }
}
