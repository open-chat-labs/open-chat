use crate::model::group_chat::GroupChat;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::chat_id::GroupChatId;

#[derive(Default)]
pub struct GroupChats {
    group_chats: HashMap<GroupChatId, GroupChat>,
}

impl GroupChats {
    pub fn add(&mut self, group_chat_id: GroupChatId) -> bool {
        match self.group_chats.entry(group_chat_id) {
            Vacant(e) => {
                e.insert(GroupChat::new(group_chat_id));
                true
            }
            Occupied(_) => false,
        }
    }
}
