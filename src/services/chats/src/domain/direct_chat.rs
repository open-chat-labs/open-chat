use super::chat::*;
use super::messages::*;
use crate::utils;
use ic_cdk::export::candid::CandidType;
use range_set::RangeSet;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use std::ops::RangeInclusive;

pub struct DirectChat {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    user2_unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    messages: Vec<Message>,
    last_updated: Timestamp,
    user1_muted: bool,
    user2_muted: bool,
}

#[derive(CandidType)]
pub struct DirectChatSummary {
    id: ChatId,
    them: UserId,
    display_date: Timestamp,
    last_updated: Timestamp,
    unread_by_me_message_id_ranges: Vec<[u32; 2]>,
    unread_by_them_message_id_ranges: Vec<[u32; 2]>,
    latest_messages: Vec<Message>,
    muted: bool,
}

#[derive(CandidType, Deserialize)]
pub struct DirectChatStableState {
    id: ChatId,
    user1: UserId,
    user2: UserId,
    user1_unread_message_id_ranges: Vec<[u32; 2]>,
    user2_unread_message_id_ranges: Vec<[u32; 2]>,
    messages: Vec<Message>,
    last_updated: Timestamp,
    user1_muted: bool,
    user2_muted: bool,
}

impl DirectChat {
    pub fn new(id: ChatId, sender: UserId, recipient: UserId, now: Timestamp) -> DirectChat {
        DirectChat {
            id,
            user1: sender,
            user2: recipient,
            user1_unread_message_ids: RangeSet::new(),
            user2_unread_message_ids: RangeSet::new(),
            messages: vec![],
            last_updated: now,
            user1_muted: false,
            user2_muted: false,
        }
    }

    pub fn get_participants(&self) -> [&UserId; 2] {
        [&self.user1, &self.user2]
    }

    pub fn get_other(&self, me: &UserId) -> &UserId {
        if *me == self.user1 {
            &self.user2
        } else {
            &self.user1
        }
    }

    pub fn notifications_muted(&self, user_id: UserId) -> bool {
        if user_id == self.user1 {
            self.user1_muted
        } else if user_id == self.user2 {
            self.user2_muted
        } else {
            true
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

    fn push_message(
        &mut self,
        sender: &UserId,
        client_message_id: String,
        content: MessageContent,
        replies_to: Option<ReplyContext>,
        now: Timestamp,
    ) -> Message {
        let id = match self.messages.last() {
            Some(message) => message.get_id() + 1,
            None => 1,
        };

        let message = Message::new(id, client_message_id, now, *sender, content, replies_to);

        self.messages.push(message.clone());

        if sender == &self.user1 {
            self.user2_unread_message_ids.insert(id);
        } else {
            self.user1_unread_message_ids.insert(id);
        }

        self.last_updated = now;

        message
    }

    fn get_messages(&self, _user: &UserId, from_id: u32, page_size: u32) -> Vec<Message> {
        get_messages(&self.messages, from_id, page_size, 1)
    }

    fn get_messages_by_id(&self, _user: &UserId, ids: Vec<u32>) -> Vec<Message> {
        get_messages_by_id(&self.messages, ids, 1)
    }

    fn get_message_mut(&mut self, id: u32) -> Option<&mut Message> {
        self.messages.get_mut((id - 1) as usize)
    }

    fn get_latest_message_id(&self) -> u32 {
        get_latest_message_id(&self.messages)
    }

    fn search_messages(&self, search_term: &str, _user: &UserId) -> Vec<Message> {
        search_messages(self.messages.as_slice(), search_term)
    }

    fn mark_read(
        &mut self,
        me: &UserId,
        from_id: u32,
        to_id: u32,
        now: Timestamp,
    ) -> MarkReadResult {
        let unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>;
        if *me == self.user1 {
            self.user1_unread_message_ids.remove_range(from_id..=to_id);
            unread_message_ids = self.user1_unread_message_ids.clone();
        } else {
            self.user2_unread_message_ids.remove_range(from_id..=to_id);
            unread_message_ids = self.user2_unread_message_ids.clone();
        };

        self.last_updated = now;

        MarkReadResult::new(utils::range_set_to_vec(unread_message_ids))
    }

    fn mute_notifications(&mut self, user_id: UserId, mute: bool) {
        if user_id == self.user1 {
            self.user1_muted = mute;
        } else if user_id == self.user2 {
            self.user2_muted = mute;
        }
    }

    fn get_unread_message_id_ranges(&self, user_id: &UserId) -> Vec<[u32; 2]> {
        let is_user1 = *user_id == self.user1;
        let unread_message_ids = if is_user1 {
            &self.user1_unread_message_ids
        } else {
            &self.user2_unread_message_ids
        };

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
        ChatSummary::Direct(DirectChatSummary::new(self, me, message_count))
    }
}

impl DirectChatSummary {
    pub fn new(chat: &DirectChat, me: &UserId, message_count: u32) -> DirectChatSummary {
        let is_user1 = *me == chat.user1;
        let them = if is_user1 { chat.user2 } else { chat.user1 };
        let unread_by_me_message_id_ranges = chat.get_unread_message_id_ranges(me);
        let unread_by_them_message_id_ranges = chat.get_unread_message_id_ranges(&them);

        let latest_messages = chat
            .messages
            .iter()
            .rev()
            .take(message_count as usize)
            .cloned()
            .collect();

        DirectChatSummary {
            id: chat.id,
            them,
            display_date: chat.get_display_date(me),
            last_updated: chat.last_updated,
            unread_by_me_message_id_ranges,
            unread_by_them_message_id_ranges,
            latest_messages,
            muted: chat.notifications_muted(*me),
        }
    }
}

impl DirectChatStableState {
    pub fn get_id(&self) -> ChatId {
        self.id
    }

    pub fn get_participants(&self) -> [&UserId; 2] {
        [&self.user1, &self.user2]
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
            last_updated: chat.last_updated,
            user1_muted: chat.user1_muted,
            user2_muted: chat.user2_muted,
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
            last_updated: chat.last_updated,
            user1_muted: chat.user1_muted,
            user2_muted: chat.user2_muted,
        }
    }
}
