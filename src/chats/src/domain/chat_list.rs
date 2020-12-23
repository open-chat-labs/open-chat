use std::collections::{HashMap, hash_map::Entry::{Occupied, Vacant}};
use ic_types::Principal;
use shared::timestamp::Timestamp;
use shared::upgrade::StableState;
use super::chat::{Chat, ChatEnum, ChatId, ChatSummary};
use super::direct_chat::DirectChat;
use super::group_chat::GroupChat;

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<ChatId, ChatEnum>
}

impl ChatList {
    pub fn create_direct_chat(&mut self, sender: Principal, recipient: Principal, text: String, now: Timestamp) -> Option<ChatId> {
        let chat_id = ChatId::for_direct_chat(&sender, &recipient);
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                e.insert(ChatEnum::Direct(DirectChat::new(chat_id, sender, recipient, text, now)));
                Some(chat_id)
            }
        }
    }

    pub fn create_group_chat(&mut self, creator: Principal, participants: Vec<Principal>, subject: String, now: Timestamp) -> Option<ChatId> {
        let chat_id = ChatId::for_group_chat(&creator, now);
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                e.insert(ChatEnum::Group(GroupChat::new(chat_id, subject, creator, participants, now)));
                Some(chat_id)
            }
        }
    }

    pub fn get(&self, chat_id: ChatId, me: &Principal) -> Option<&ChatEnum> {
        let chat = self.chats.get(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn get_mut(&mut self, chat_id: ChatId, me: &Principal) -> Option<&mut ChatEnum> {
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
            let t1 = c1.get_updated_date();
            let t2 = c2.get_updated_date();
            t2.cmp(&t1)
        });

        list
    }
}

impl StableState for ChatList {
    type State = Vec<ChatEnum>;

    fn drain(self) -> Vec<ChatEnum> {
        self.chats
            .into_iter()
            .map(|(_, c)| c)
            .collect()
    }

    fn fill(chats: Vec<ChatEnum>) -> ChatList {
        let map: HashMap<ChatId, ChatEnum> = chats
            .into_iter()
            .map(|c| (c.get_id(), c))
            .collect();
        
        ChatList {
            chats: map
        }
    }
}
