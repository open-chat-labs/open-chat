use crate::model::group_chat::GroupChat;
use candid::CandidType;
use serde::Deserialize;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, TimestampMillis};

#[derive(CandidType, Deserialize, Default)]
pub struct GroupChats {
    group_chats: HashMap<ChatId, GroupChat>,
}

impl GroupChats {
    pub fn get_all(&self, updated_since: Option<TimestampMillis>) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values().filter(move |&c| {
            if let Some(updated_since) = updated_since {
                c.last_updated() > updated_since
            } else {
                true
            }
        })
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut GroupChat> {
        self.group_chats.get_mut(chat_id)
    }

    pub fn add(&mut self, chat_id: ChatId, now: TimestampMillis) -> bool {
        match self.group_chats.entry(chat_id) {
            Vacant(e) => {
                e.insert(GroupChat::new(chat_id, now));
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn remove(&mut self, chat_id: &ChatId) {
        self.group_chats.remove(chat_id);
    }

    pub fn iter(&self) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values()
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.group_chats.len()
    }
}
