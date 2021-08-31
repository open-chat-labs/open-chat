use crate::model::group_chat::GroupChat;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::ChatId;

#[derive(Default)]
pub struct GroupChats {
    group_chats: HashMap<ChatId, GroupChat>,
}

impl GroupChats {
    pub fn add(&mut self, chat_id: ChatId) -> bool {
        match self.group_chats.entry(chat_id) {
            Vacant(e) => {
                e.insert(GroupChat::new(chat_id));
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

    pub fn len(&self) -> usize {
        self.group_chats.len()
    }
}
