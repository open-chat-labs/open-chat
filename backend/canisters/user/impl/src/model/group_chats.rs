use crate::model::group_chat::GroupChat;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, MessageIndex, TimestampMillis};

const MAX_GROUPS_PER_USER: u32 = 10;

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

    pub fn create(&mut self, chat_id: ChatId, now: TimestampMillis) -> bool {
        if self.groups_created >= MAX_GROUPS_PER_USER {
            false
        } else {
            self.join(chat_id, false, false, None, now);
            self.groups_created += 1;
            true
        }
    }

    pub fn join(
        &mut self,
        chat_id: ChatId,
        as_super_admin: bool,
        notifications_muted: bool,
        read_up_to: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> bool {
        match self.group_chats.entry(chat_id) {
            Vacant(e) => {
                e.insert(GroupChat::new(chat_id, as_super_admin, notifications_muted, read_up_to, now));
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

    pub fn iter(&self) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut GroupChat> {
        self.group_chats.values_mut()
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<ChatId> {
        self.removed
            .iter()
            .rev()
            .take_while(|g| g.timestamp > timestamp)
            .map(|g| g.chat_id)
            .collect()
    }

    pub fn max_groups_created(&self) -> Option<u32> {
        if self.groups_created >= MAX_GROUPS_PER_USER {
            Some(MAX_GROUPS_PER_USER)
        } else {
            None
        }
    }

    pub fn groups_created(&self) -> u32 {
        self.groups_created
    }

    pub fn len(&self) -> usize {
        self.group_chats.len()
    }
}
