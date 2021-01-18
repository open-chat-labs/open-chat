use std::collections::{HashMap, hash_map::Entry::{Occupied, Vacant}};
use shared::timestamp::Timestamp;
use shared::upgrade::StableState;
use shared::user_id::UserId;
use super::chat::{Chat, ChatEnum, ChatId, ChatSummary, MessagePayload};
use super::direct_chat::DirectChat;
use super::group_chat::GroupChat;

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<ChatId, ChatEnum>,
}

impl ChatList {
    pub fn create_direct_chat(&mut self, chat_id: ChatId, sender: UserId, recipient: UserId, payload: MessagePayload, now: Timestamp) -> u32 {
        let chat = ChatEnum::Direct(DirectChat::new(chat_id, sender, recipient, payload, now));
        self.chats.insert(chat_id, chat);
        1
    }

    pub fn create_group_chat(&mut self, creator: UserId, participants: Vec<UserId>, subject: String, now: Timestamp) -> Option<ChatId> {
        let chat_id = ChatId::for_group_chat(&creator, now);
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                e.insert(ChatEnum::Group(GroupChat::new(chat_id, subject, creator, participants, now)));
                Some(chat_id)
            }
        }
    }

    pub fn get(&self, chat_id: ChatId, me: &UserId) -> Option<&ChatEnum> {
        let chat = self.chats.get(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn get_mut(&mut self, chat_id: ChatId, me: &UserId) -> Option<&mut ChatEnum> {
        let chat = self.chats.get_mut(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn get_chats(
        &self,
        user: &UserId,
        updated_since: Option<Timestamp>,
        message_count_for_top_chat: Option<u16>) -> Vec<ChatSummary> {

        let top_message_count = match message_count_for_top_chat {
            Some(c) => c as u32,
            None => 1
        };

        // For now this will iterate through every chat...
        let mut list: Vec<_> = self
            .chats
            .values()
            .filter(|chat| chat.involves_user(user))
            .filter(|chat| updated_since.is_none() || chat.get_updated_date(user) > updated_since.unwrap())
            .collect();

        list.sort_unstable_by(|c1, c2| {
            let t1 = c1.get_updated_date(user);
            let t2 = c2.get_updated_date(user);
            t2.cmp(&t1)
        });

        list
            .iter()
            .enumerate()
            .map(|(i, chat)| chat.to_summary(user, if i == 0 {top_message_count} else {1}))
            .collect()
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
