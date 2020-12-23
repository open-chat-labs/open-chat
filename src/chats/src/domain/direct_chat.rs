use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use super::chat::*;

#[derive(CandidType, Deserialize)]
pub struct DirectChat {
    id: ChatId,
    user1: Principal,
    user2: Principal,
    user1_latest_read: u32,
    user2_latest_read: u32,
    messages: Vec<Message>
}

impl DirectChat {
    pub fn new(id: ChatId, sender: Principal, recipient: Principal, text: String, now: Timestamp) -> DirectChat {

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

    fn involves_user(&self, user: &Principal) -> bool {
        self.user1 == *user || self.user2 == *user
    }

    fn push_message(&mut self, sender: &Principal, text: String, timestamp: Timestamp) -> u32 {
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

    fn get_messages(&self, from_id: u32) -> Vec<Message> {
        let start_id = self.messages.first().unwrap().get_id();

        let from_index = (if from_id > start_id { from_id - start_id } else { 0 }) as usize;

        if from_index >= self.messages.len() {
            return Vec::new();
        }

        self.messages[from_index..]
            .iter()
            .map(|m| m.clone())
            .collect()
    }

    fn mark_read(&mut self, me: &Principal, up_to_id: u32) -> u32 {
        let is_user1 = *me == self.user1;

        if is_user1 {
            self.user1_latest_read = up_to_id;
        } else {
            self.user2_latest_read = up_to_id;
        }

        self.messages.last().unwrap().get_id()
    }

    fn to_summary(&self, me: &Principal) -> ChatSummary {
        ChatSummary::Direct(DirectChatSummary::new(&self, me))
    }
}

#[derive(CandidType)]
pub struct DirectChatSummary {
    id: ChatId,
    them: Principal,
    unread: u32,
    latest_message: Message
}

impl DirectChatSummary {
    fn new(chat: &DirectChat, me: &Principal) -> DirectChatSummary {
        let latest_message = chat.messages.last().unwrap().clone();
        let is_user1 = *me == chat.user1;
        let them = if is_user1 { chat.user2.clone() } else { chat.user1.clone() };
        let unread = latest_message.get_id() - (if is_user1 { chat.user1_latest_read } else { chat.user2_latest_read });

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