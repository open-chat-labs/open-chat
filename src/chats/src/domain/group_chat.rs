use std::cmp::{max, min};
use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use super::chat::*;
use super::messages::*;

#[derive(CandidType, Deserialize)]
pub struct GroupChat {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<Participant>,
    messages: Vec<Message>
}

#[derive(CandidType, Deserialize)]
struct Participant {
    user_id: UserId,
    admin: bool,
    latest_read: u32,
    date_added: Timestamp
}

#[derive(CandidType)]
pub struct GroupChatSummary {
    id: ChatId,
    subject: String,
    updated_date: Timestamp,
    participants: Vec<UserId>,
    unread: u32,
    latest_message: Option<Message>
}

impl GroupChat {
    pub fn new(
        id: ChatId,
        subject: String,
        creator: UserId,
        participants: Vec<UserId>,
        now: Timestamp) -> GroupChat {

        let mut all_participants = Vec::with_capacity(participants.len() + 1);
        all_participants.push(Participant::new(creator, true, now));
        for p in participants {
            all_participants.push(Participant::new(p, false, now))
        }

        GroupChat {
            id,
            subject,
            description: None,
            participants: all_participants,
            messages: Vec::new()
        }
    }

    pub fn add_participants(&mut self, requested_by: &UserId, users_to_add: Vec<UserId>, now: Timestamp) -> Option<u32> {
        if !self.is_admin(requested_by) {
            return None;
        }

        let mut count_added = 0;
        for user_to_add in users_to_add {
            if self.find_participant(&user_to_add).is_some() {
                continue;
            }
            self.participants.push(Participant::new(user_to_add, false, now));
            count_added += 1;
        }

        Some(count_added)
    }

    pub fn remove_participant(&mut self, requested_by: &UserId, user_to_remove: &UserId) -> Option<bool> {
        if !self.is_admin(requested_by) {
            return None;
        }

        let original_count = self.participants.len();
        self.participants.retain(|p| p.user_id != *user_to_remove);
        let new_count = self.participants.len();

        Some(new_count < original_count)
    }

    fn is_admin(&self, user: &UserId) -> bool {
        match self.find_participant(user) {
            Some(p) => p.admin,
            None => false
        }
    }

    fn find_participant(&self, user_id: &UserId) -> Option<&Participant> {
        self.participants.iter().find(|p| p.user_id == *user_id)
    }
}

impl Chat for GroupChat {
    fn get_id(&self) -> ChatId {
        self.id
    }

    fn involves_user(&self, user: &UserId) -> bool {
        self.participants.iter().any(|p| p.user_id == *user)
    }

    fn push_message(&mut self, sender: &UserId, text: String, now: Timestamp) -> u32 {

        let id = match self.messages.last() {
            Some(message) => message.get_id() + 1,
            None => 1
        };

        let message = Message::new(
            id,
            now,
            sender.clone(),
            text
        );

        self.messages.push(message);

        let participant = self
            .participants
            .iter_mut()
            .find(|p| p.user_id == *sender)
            .unwrap();

        if participant.latest_read == id - 1 {
            participant.latest_read = id;
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

    fn mark_read(&mut self, me: &UserId, up_to_id: u32) -> u32 {

        let participant = self
            .participants
            .iter_mut()
            .find(|p| p.user_id == *me)
            .unwrap();

        let latest_id = self.messages.last().unwrap().get_id();

        let up_to_id = min(up_to_id, latest_id);

        if participant.latest_read < up_to_id {
            participant.latest_read = up_to_id;
        }

        latest_id
    }

    fn get_unread_count(&self, user_id: &UserId) -> u32 {
        let user = self.participants.iter().find(|p| p.user_id == *user_id).unwrap();

        let latest_message = self.messages.last();

        if let Some(message) = latest_message {
            message.get_id() - user.latest_read
        } else {
            0
        }
    }

    fn to_summary(&self, me: &UserId) -> ChatSummary {
        ChatSummary::Group(GroupChatSummary::new(self, me))
    }
}

impl Participant {
    fn new(user_id: UserId, admin: bool, now: Timestamp) -> Participant {
        Participant {
            user_id,
            admin,
            latest_read: 0,
            date_added: now
        }
    }
}

impl GroupChatSummary {
    fn new(chat: &GroupChat, me: &UserId) -> GroupChatSummary {
        let unread = chat.get_unread_count(me);

        let me = chat.participants.iter().find(|p| p.user_id == *me).unwrap();

        fn calc_updated_date(chat: &GroupChat, me: &Participant) -> Timestamp {
            let mut updated_date = me.date_added;

            if let Some(message) = chat.messages.last() {
                updated_date = max(updated_date, message.get_timestamp());
            }

            updated_date
        }

        let latest_message = chat.messages.last().map(|m| m.clone());

        GroupChatSummary {
            id: chat.id,
            subject: chat.subject.clone(),
            updated_date: calc_updated_date(chat, me),
            participants: chat.participants.iter().map(|p| p.user_id.clone()).collect(),
            unread,
            latest_message
        }
    }

    pub fn get_updated_date(&self) -> Timestamp {
        self.updated_date
    }
}

