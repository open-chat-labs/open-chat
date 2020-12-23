use std::collections::{HashMap, hash_map::Entry::{Occupied, Vacant}};
use ic_types::Principal;
use shared::StableState;
use super::chat::{Chat, ChatId, ChatSummary, ChatType};
use super::direct_chat::DirectChat;
use super::group_chat::GroupChat;

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<ChatId, ChatType>
}

impl ChatList {
    pub fn create_direct_chat(&mut self, sender: Principal, recipient: Principal, text: String, timestamp: u64) -> Option<ChatId> {
        let chat_id = ChatId::for_direct_chat(&sender, &recipient);
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                e.insert(ChatType::Direct(DirectChat::new(chat_id, sender, recipient, text, timestamp)));
                Some(chat_id)
            }
        }
    }

    pub fn create_group_chat(&mut self, creator: Principal, participants: Vec<Principal>, subject: String, timestamp: u64) -> Option<ChatId> {
        let chat_id = ChatId::for_group_chat(&creator, timestamp);
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                e.insert(ChatType::Group(GroupChat::new(chat_id, subject, creator, participants)));
                Some(chat_id)
            }
        }
    }

    pub fn get(&self, chat_id: ChatId, me: &Principal) -> Option<&ChatType> {
        let chat = self.chats.get(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn get_mut(&mut self, chat_id: ChatId, me: &Principal) -> Option<&mut ChatType> {
        let chat = self.chats.get_mut(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn list_chats(&self, user: &Principal) -> Vec<ChatSummary> {
        // For now this will iterate through every chat...
        let mut list: Vec<_> = self
            .chats
            .values()
            .filter(|chat| chat.involves_user(user))
            .map(|chat| chat.to_summary(user))
            .collect();

        list.sort_unstable_by(|c1, c2| {
            let t1 = c1.get_most_recent().map(|m| m.get_timestamp());
            let t2 = c2.get_most_recent().map(|m| m.get_timestamp());
            t2.cmp(&t1)
        });

        list
    }
}

impl StableState for ChatList {
    type State = Vec<ChatType>;

    fn drain(self) -> Vec<ChatType> {
        self.chats
            .into_iter()
            .map(|(_, c)| c)
            .collect()
    }

    fn fill(chats: Vec<ChatType>) -> ChatList {
        let map: HashMap<ChatId, ChatType> = chats
            .into_iter()
            .map(|c| (c.get_id(), c))
            .collect();
        
        ChatList {
            chats: map
        }
    }
}
