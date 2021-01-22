use std::cmp::max;
use std::ops::RangeInclusive;
use ic_cdk::export::candid::CandidType;
use range_set::RangeSet;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::utils;
use super::chat::*;
use super::messages::*;

pub struct GroupChat {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<Participant>,
    messages: Vec<Message>
}

struct Participant {
    user_id: UserId,
    admin: bool,
    date_added: Timestamp,
    unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>
}

#[derive(CandidType)]
pub struct GroupChatSummary {
    id: ChatId,
    subject: String,
    updated_date: Timestamp,
    participants: Vec<UserId>,
    unread_message_id_ranges: Vec<[u32; 2]>,
    latest_messages: Vec<Message>
}

#[derive(CandidType, Deserialize)]
pub struct GroupChatStableState {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<ParticipantStableState>,
    messages: Vec<Message>
}

#[derive(CandidType, Deserialize)]
pub struct ParticipantStableState {
    user_id: UserId,
    admin: bool,
    date_added: Timestamp,
    unread_message_ids: Vec<[u32; 2]>
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
            all_participants.push(Participant::new(p, true, now))
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

    fn push_message(&mut self, sender: &UserId, content: MessageContent, now: Timestamp) -> u32 {

        let id = match self.messages.last() {
            Some(message) => message.get_id() + 1,
            None => 1
        };

        let message = Message::new(
            id,
            now,
            sender.clone(),
            content
        );

        self.messages.push(message);

        for p in self.participants.iter_mut().filter(|p| p.user_id != *sender) {
            p.unread_message_ids.insert(id);
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

        let participant = self
            .participants
            .iter_mut()
            .find(|p| p.user_id == *me)
            .unwrap();

        participant.unread_message_ids.remove_range(from_id..=to_id);

        MarkReadResult::new(participant.unread_message_ids.iter().collect())
    }

    fn get_unread_message_id_ranges(&self, user_id: &UserId) -> Vec<[u32; 2]> {
        let participant = self.participants.iter().find(|p| p.user_id == *user_id).unwrap();

        utils::range_set_to_vec(participant.unread_message_ids.clone())
    }

    fn get_updated_date(&self, user_id: &UserId) -> Timestamp {
        let user = self.participants.iter().find(|p| p.user_id == *user_id).unwrap();
        let mut updated_date = user.date_added;

        if let Some(message) = self.messages.last() {
            updated_date = max(updated_date, message.get_timestamp());
        }

        updated_date
    }

    fn to_summary(&self, me: &UserId, message_count: u32) -> ChatSummary {
        ChatSummary::Group(GroupChatSummary::new(self, me, message_count))
    }
}

impl Participant {
    fn new(user_id: UserId, admin: bool, now: Timestamp) -> Participant {
        Participant {
            user_id,
            admin,
            unread_message_ids: RangeSet::new(),
            date_added: now
        }
    }
}

impl GroupChatSummary {
    fn new(chat: &GroupChat, me: &UserId, message_count: u32) -> GroupChatSummary {
        let unread_message_id_ranges = chat.get_unread_message_id_ranges(me);

        let latest_messages = chat
            .messages
            .iter()
            .rev()
            .take(message_count as usize)
            .map(|m| m.clone())
            .collect();

        GroupChatSummary {
            id: chat.id,
            subject: chat.subject.clone(),
            updated_date: chat.get_updated_date(me),
            participants: chat.participants.iter().map(|p| p.user_id.clone()).collect(),
            unread_message_id_ranges,
            latest_messages
        }
    }
}

impl GroupChatStableState {
    pub fn get_id(&self) -> ChatId {
        self.id
    }
}

impl From<GroupChat> for GroupChatStableState {
    fn from(chat: GroupChat) -> Self {
        GroupChatStableState {
            id: chat.id,
            subject: chat.subject,
            description: chat.description,
            participants: chat.participants.into_iter().map(|p| p.into()).collect(),
            messages: chat.messages
        }
    }
}

impl From<GroupChatStableState> for GroupChat {
    fn from(chat: GroupChatStableState) -> Self {
        GroupChat {
            id: chat.id,
            subject: chat.subject,
            description: chat.description,
            participants: chat.participants.into_iter().map(|p| p.into()).collect(),
            messages: chat.messages
        }
    }
}

impl From<Participant> for ParticipantStableState {
    fn from(participant: Participant) -> Self {
        ParticipantStableState {
            user_id: participant.user_id,
            admin: participant.admin,
            date_added: participant.date_added,
            unread_message_ids: utils::range_set_to_vec(participant.unread_message_ids)

        }
    }
}

impl From<ParticipantStableState> for Participant {
    fn from(participant: ParticipantStableState) -> Self {
        Participant {
            user_id: participant.user_id,
            admin: participant.admin,
            date_added: participant.date_added,
            unread_message_ids: utils::vec_to_range_set(participant.unread_message_ids)
        }
    }
}