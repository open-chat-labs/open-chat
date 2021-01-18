use std::cmp::min;
use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use super::chat::*;
use super::messages::*;

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
    updated_date: Timestamp,
    unread: u32,
    latest_messages: Vec<Message>
}

impl DirectChat {
    pub fn new(id: ChatId, sender: UserId, recipient: UserId, content: MessageContent, now: Timestamp) -> DirectChat {

        let message = Message::new(1, now, sender.clone(), content);

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

    fn push_message(&mut self, sender: &UserId, content: MessageContent, timestamp: Timestamp) -> u32 {
        let prev_id = self.messages.last().unwrap().get_id();
        let id = prev_id + 1;

        let message = Message::new(
            id,
            timestamp,
            sender.clone(),
            content
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
        get_messages(&self.messages, from_id, page_size)
    }

    fn get_messages_by_id(&self, ids: Vec<u32>) -> Vec<Message> {
        get_messages_by_id(&self.messages, ids)
    }

    fn get_latest_message_id(&self) -> u32 {
        get_latest_message_id(&self.messages)
    }

    fn mark_read(&mut self, me: &UserId, up_to_id: u32) -> MarkReadResult {
        let latest_read = if *me == self.user1 {
            &mut self.user1_latest_read
        } else {
            &mut self.user2_latest_read
        };

        let latest_id = self.messages.last().unwrap().get_id();

        let up_to_id = min(up_to_id, latest_id);

        if *latest_read < up_to_id {
            *latest_read = up_to_id;
        }

        MarkReadResult::new(*latest_read, latest_id)
    }

    fn get_unread_count(&self, user_id: &UserId) -> u32 {
        let is_user1 = *user_id == self.user1;

        let latest_message = self.messages.last().unwrap();

        let latest_read = if is_user1 { self.user1_latest_read } else { self.user2_latest_read };

        latest_message.get_id() - latest_read
    }

    fn get_updated_date(&self, _user_id: &UserId) -> Timestamp {
        let latest_message = self.messages.last().unwrap();
        latest_message.get_timestamp()
    }

    fn to_summary(&self, me: &UserId, message_count: u32) -> ChatSummary {
        ChatSummary::Direct(DirectChatSummary::new(&self, me, message_count))
    }
}

impl DirectChatSummary {
    fn new(chat: &DirectChat, me: &UserId, message_count: u32) -> DirectChatSummary {
        let is_user1 = *me == chat.user1;
        let them = if is_user1 { chat.user2.clone() } else { chat.user1.clone() };
        let unread = chat.get_unread_count(me);
        let latest_messages: Vec<_> = chat
            .messages
            .iter()
            .rev()
            .take(message_count as usize)
            .map(|m| m.clone())
            .collect();

        let updated_date = latest_messages.first().unwrap().get_timestamp();

        DirectChatSummary {
            id: chat.id,
            them,
            updated_date,
            unread,
            latest_messages
        }
    }
}