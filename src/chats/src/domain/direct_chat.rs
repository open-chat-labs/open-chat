use std::cmp::{max, min};
use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use super::chat::*;

#[derive(CandidType, Deserialize)]
pub struct DirectChat {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_latest_read: u32,
    user2_latest_read: u32,
    messages: Vec<Message>
}

#[derive(CandidType)]
pub struct DirectChatSummary {
    id: ChatId,
    them: UserId,
    unread: u32,
    latest_message: Message
}

impl DirectChat {
    pub fn new(id: ChatId, sender: UserId, recipient: UserId, text: String, now: Timestamp) -> DirectChat {

        let message = Message::new(1, now, sender.clone(), text);

        DirectChat {
            id,
            user1: sender,
            user2: recipient,
            user1_latest_read: 1,
            user2_latest_read: 0,
            messages: vec![message]
        }
    }
}

impl Chat for DirectChat {
    fn get_id(&self) -> ChatId {
        self.id
    }

    fn involves_user(&self, user: &UserId) -> bool {
        self.user1 == *user || self.user2 == *user
    }

    fn push_message(&mut self, sender: &UserId, text: String, timestamp: Timestamp) -> u32 {
        let prev_id = self.messages.last().unwrap().get_id();
        let id = prev_id + 1;

        let message = Message::new(
            id,
            timestamp,
            sender.clone(),
            text
        );

        self.messages.push(message);

        if sender == &self.user1 {
            if self.user1_latest_read == prev_id {
                self.user1_latest_read = id;
            }
        } else {
            if self.user2_latest_read == prev_id {
                self.user2_latest_read = id;
            }
        }

        id
    }

    fn get_messages(&self, from_id: u32, page_size: u32) -> Vec<Message> {
        let earliest_id = self.messages.first().unwrap().get_id();
        let latest_id = self.messages.last().unwrap().get_id();

        let from_id = max(from_id, earliest_id);

        if from_id > latest_id {
            return Vec::new();
        }

        let page_size = page_size as usize;
        let from_index = (from_id - earliest_id) as usize;
        let to_index = min(from_index + page_size, self.messages.len());

        self.messages[from_index..to_index]
            .iter()
            .map(|m| m.clone())
            .collect()
    }

    fn get_latest_message_id(&self) -> u32 {
        self.messages.last().unwrap().get_id()
    }

    fn mark_read(&mut self, me: &UserId, up_to_id: u32) -> u32 {
        let is_user1 = *me == self.user1;

        let latest_id = self.messages.last().unwrap().get_id();

        let up_to_id = min(up_to_id, latest_id);

        if is_user1 {
            if self.user1_latest_read < up_to_id {
                self.user1_latest_read = up_to_id;
            }
        } else {
            if self.user2_latest_read < up_to_id {
                self.user2_latest_read = up_to_id;
            }
        }

        latest_id
    }

    fn get_unread_count(&self, user_id: &UserId) -> u32 {
        let is_user1 = *user_id == self.user1;

        let latest_message = self.messages.last().unwrap();

        let latest_read = if is_user1 { self.user1_latest_read } else { self.user2_latest_read };

        latest_message.get_id() - latest_read
    }

    fn to_summary(&self, me: &UserId) -> ChatSummary {
        ChatSummary::Direct(DirectChatSummary::new(&self, me))
    }
}

impl DirectChatSummary {
    fn new(chat: &DirectChat, me: &UserId) -> DirectChatSummary {
        let is_user1 = *me == chat.user1;
        let them = if is_user1 { chat.user2.clone() } else { chat.user1.clone() };
        let unread = chat.get_unread_count(me);
        let latest_message = chat.messages.last().unwrap().clone();

        DirectChatSummary {
            id: chat.id,
            them,
            unread,
            latest_message
        }
    }

    pub fn get_updated_date(&self) -> Timestamp {
        self.latest_message.get_timestamp()
    }
}