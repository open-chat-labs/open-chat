use crate::model::group_chat::GroupChat;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, MessageIndex, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct GroupChats {
    groups_created: u32,
    group_chats: HashMap<ChatId, GroupChat>,
    removed: Vec<RemovedGroup>,
}

#[derive(Serialize, Deserialize)]
struct RemovedGroup {
    chat_id: ChatId,
    timestamp: TimestampMillis,
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

    pub fn get(&self, chat_id: &ChatId) -> Option<&GroupChat> {
        self.group_chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut GroupChat> {
        self.group_chats.get_mut(chat_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.group_chats.values().any(|c| c.last_updated() > since)
    }

    pub fn create(&mut self, chat_id: ChatId, now: TimestampMillis) -> bool {
        self.join(chat_id, None, now);
        self.groups_created += 1;
        true
    }

    pub fn join(&mut self, chat_id: ChatId, read_up_to: Option<MessageIndex>, now: TimestampMillis) -> bool {
        match self.group_chats.entry(chat_id) {
            Vacant(e) => {
                e.insert(GroupChat::new(chat_id, read_up_to, now));
                self.removed.retain(|g| g.chat_id != chat_id);
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        let group = self.group_chats.remove(&chat_id);
        if group.is_some() {
            self.removed.push(RemovedGroup { chat_id, timestamp: now });
        }
        group
    }

    pub fn exists(&self, chat_id: &ChatId) -> bool {
        self.group_chats.contains_key(chat_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values()
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<ChatId> {
        self.removed
            .iter()
            .rev()
            .take_while(|g| g.timestamp > timestamp)
            .map(|g| g.chat_id)
            .collect()
    }

    pub fn groups_created(&self) -> u32 {
        self.groups_created
    }

    pub fn len(&self) -> usize {
        self.group_chats.len()
    }

    pub fn has(&self, chat_id: &ChatId) -> bool {
        self.group_chats.contains_key(chat_id)
    }
}
