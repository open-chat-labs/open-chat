use std::ops::{RangeInclusive};
use ic_cdk::export::candid::CandidType;
use range_set::RangeSet;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use super::chat::*;
use super::messages::*;
use crate::utils;

pub struct DirectChat {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    user2_unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    messages: Vec<Message>
}

#[derive(CandidType)]
pub struct DirectChatSummary {
    id: ChatId,
    them: UserId,
    updated_date: Timestamp,
    unread_message_id_ranges: Vec<[u32; 2]>,
    latest_messages: Vec<Message>
}

#[derive(CandidType, Deserialize)]
pub struct DirectChatStableState {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_unread_message_ids: Vec<[u32; 2]>,
    user2_unread_message_ids: Vec<[u32; 2]>,
    messages: Vec<Message>
}

impl DirectChat {
    pub fn new(id: ChatId, sender: UserId, recipient: UserId, content: MessageContent, now: Timestamp) -> DirectChat {

        let message = Message::new(1, now, sender.clone(), content);

        DirectChat {
            id,
            user1: sender,
            user2: recipient,
            user1_unread_message_ids: RangeSet::new(),
            user2_unread_message_ids: RangeSet::from(1..=1),
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
            self.user2_unread_message_ids.insert(id);
        } else {
            self.user1_unread_message_ids.insert(id);
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

    fn mark_read(&mut self, me: &UserId, from_id: u32, to_id: u32) -> MarkReadResult {
        let unread_message_ids: Vec<u32>;
        if *me == self.user1 {
            &mut self.user1_unread_message_ids.remove_range(from_id..=to_id);
            unread_message_ids = self.user1_unread_message_ids.iter().collect();
        } else {
            &mut self.user2_unread_message_ids.remove_range(from_id..=to_id);
            unread_message_ids = self.user2_unread_message_ids.iter().collect();
        };

        MarkReadResult::new(unread_message_ids)
    }

    fn get_unread_message_id_ranges(&self, user_id: &UserId) -> Vec<[u32; 2]> {
        let is_user1 = *user_id == self.user1;
        let unread_message_ids = if is_user1 { &self.user1_unread_message_ids } else { &self.user2_unread_message_ids };

        utils::range_set_to_vec(unread_message_ids.clone())
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
        let unread_message_id_ranges = chat.get_unread_message_id_ranges(me);
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
            unread_message_id_ranges,
            latest_messages
        }
    }
}

impl DirectChatStableState {
    pub fn get_id(&self) -> ChatId {
        self.id
    }
}

impl From<DirectChat> for DirectChatStableState {
    fn from(chat: DirectChat) -> Self {
        DirectChatStableState {
            id: chat.id,
            user1: chat.user1,
            user2: chat.user2,
            user1_unread_message_ids: utils::range_set_to_vec(chat.user1_unread_message_ids),
            user2_unread_message_ids: utils::range_set_to_vec(chat.user2_unread_message_ids),
            messages: chat.messages
        }
    }
}

impl From<DirectChatStableState> for DirectChat {
    fn from(chat: DirectChatStableState) -> Self {
        DirectChat {
            id: chat.id,
            user1: chat.user1,
            user2: chat.user2,
            user1_unread_message_ids: utils::vec_to_range_set(chat.user1_unread_message_ids),
            user2_unread_message_ids: utils::vec_to_range_set(chat.user2_unread_message_ids),
            messages: chat.messages
        }
    }
}