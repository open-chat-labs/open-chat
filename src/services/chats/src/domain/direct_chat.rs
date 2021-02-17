use std::ops::{RangeInclusive};
use ic_cdk::export::candid::CandidType;
use range_set::RangeSet;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::utils;
use super::chat::*;
use super::messages::*;

pub struct DirectChat {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    user2_unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    messages: Vec<Message>,
    last_updated: Timestamp
}

#[derive(CandidType)]
pub struct DirectChatSummary {
    id: ChatId,
    them: UserId,
    display_date: Timestamp,
    last_updated: Timestamp,
    unread_by_me_message_id_ranges: Vec<[u32; 2]>,
    unread_by_them_message_id_ranges: Vec<[u32; 2]>,
    latest_messages: Vec<Message>
}

#[derive(CandidType, Deserialize)]
pub struct DirectChatStableState {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_unread_message_id_ranges: Vec<[u32; 2]>,
    user2_unread_message_id_ranges: Vec<[u32; 2]>,
    messages: Vec<Message>,
    last_updated: Timestamp
}

impl DirectChat {
    pub fn new(id: ChatId, sender: UserId, recipient: UserId, client_message_id: String, content: MessageContent, replies_to: Option<ReplyContext>, now: Timestamp) -> DirectChat {

        let message = Message::new(1, client_message_id, now, sender.clone(), content, replies_to);

        DirectChat {
            id,
            user1: sender,
            user2: recipient,
            user1_unread_message_ids: RangeSet::new(),
            user2_unread_message_ids: RangeSet::from(1..=1),
            messages: vec![message],
            last_updated: now
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

    fn push_message(&mut self, sender: &UserId, client_message_id: String, content: MessageContent, replies_to: Option<ReplyContext>, now: Timestamp) -> u32 {
        let prev_id = self.messages.last().unwrap().get_id();
        let id = prev_id + 1;

        let message = Message::new(
            id,
            client_message_id,
            now,
            sender.clone(),
            content,
            replies_to
        );

        self.messages.push(message);

        if sender == &self.user1 {
            self.user2_unread_message_ids.insert(id);
        } else {
            self.user1_unread_message_ids.insert(id);
        }

        self.last_updated = now;

        id
    }

    fn get_messages(&self, _user: &UserId, from_id: u32, page_size: u32) -> Vec<Message> {
        get_messages(&self.messages, from_id, page_size, 1)
    }

    fn get_messages_by_id(&self, _user: &UserId, ids: Vec<u32>) -> Vec<Message> {
        get_messages_by_id(&self.messages, ids, 1)
    }

    fn get_latest_message_id(&self) -> u32 {
        get_latest_message_id(&self.messages)
    }

    fn search_messages(&self, search_term: &str) -> Vec<Message> {
        search_messages(&self.messages, search_term)
    }

    fn mark_read(&mut self, me: &UserId, from_id: u32, to_id: u32, now: Timestamp) -> MarkReadResult {
        let unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>;
        if *me == self.user1 {
            &mut self.user1_unread_message_ids.remove_range(from_id..=to_id);
            unread_message_ids = self.user1_unread_message_ids.clone();
        } else {
            &mut self.user2_unread_message_ids.remove_range(from_id..=to_id);
            unread_message_ids = self.user2_unread_message_ids.clone();
        };

        self.last_updated = now;

        MarkReadResult::new(utils::range_set_to_vec(unread_message_ids))
    }

    fn get_unread_message_id_ranges(&self, user_id: &UserId) -> Vec<[u32; 2]> {
        let is_user1 = *user_id == self.user1;
        let unread_message_ids = if is_user1 { &self.user1_unread_message_ids } else { &self.user2_unread_message_ids };

        utils::range_set_to_vec(unread_message_ids.clone())
    }

    fn get_display_date(&self, _user_id: &UserId) -> Timestamp {
        let latest_message = self.messages.last().unwrap();
        latest_message.get_timestamp()
    }

    fn get_updated_date(&self) -> Timestamp {
        self.last_updated
    }

    fn to_summary(&self, me: &UserId, message_count: u32) -> ChatSummary {
        ChatSummary::Direct(DirectChatSummary::new(&self, me, message_count))
    }
}

impl DirectChatSummary {
    pub fn new(chat: &DirectChat, me: &UserId, message_count: u32) -> DirectChatSummary {
        let is_user1 = *me == chat.user1;
        let them = if is_user1 { chat.user2.clone() } else { chat.user1.clone() };
        let unread_by_me_message_id_ranges = chat.get_unread_message_id_ranges(me);
        let unread_by_them_message_id_ranges = chat.get_unread_message_id_ranges(&them);

        let latest_messages = chat
            .messages
            .iter()
            .rev()
            .take(message_count as usize)
            .map(|m| m.clone())
            .collect();

        DirectChatSummary {
            id: chat.id,
            them,
            display_date: chat.get_display_date(me),
            last_updated: chat.last_updated,
            unread_by_me_message_id_ranges,
            unread_by_them_message_id_ranges,
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
            user1_unread_message_id_ranges: utils::range_set_to_vec(chat.user1_unread_message_ids),
            user2_unread_message_id_ranges: utils::range_set_to_vec(chat.user2_unread_message_ids),
            messages: chat.messages,
            last_updated: chat.last_updated
        }
    }
}

impl From<DirectChatStableState> for DirectChat {
    fn from(chat: DirectChatStableState) -> Self {
        DirectChat {
            id: chat.id,
            user1: chat.user1,
            user2: chat.user2,
            user1_unread_message_ids: utils::vec_to_range_set(chat.user1_unread_message_id_ranges),
            user2_unread_message_ids: utils::vec_to_range_set(chat.user2_unread_message_id_ranges),
            messages: chat.messages,
            last_updated: chat.last_updated
        }
    }
}