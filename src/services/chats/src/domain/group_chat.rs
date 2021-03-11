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
    messages: Vec<Message>,
    last_updated: Timestamp
}

struct Participant {
    user_id: UserId,
    admin: bool,
    date_added: Timestamp,
    min_visible_message_id: u32,
    unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>
}

#[derive(CandidType)]
pub struct GroupChatSummary {
    id: ChatId,
    subject: String,
    display_date: Timestamp,
    last_updated: Timestamp,
    min_visible_message_id: u32,
    participants: Vec<UserId>,
    unread_by_me_message_id_ranges: Vec<[u32; 2]>,
    unread_by_any_message_id_ranges: Vec<[u32; 2]>,
    latest_messages: Vec<Message>
}

#[derive(CandidType, Deserialize)]
pub struct GroupChatStableState {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<ParticipantStableState>,
    messages: Vec<Message>,
    last_updated: Timestamp
}

#[derive(CandidType, Deserialize)]
pub struct GroupChatStableStatePrevious {
    id: ChatIdPrevious,
    subject: String,
    description: Option<String>,
    participants: Vec<ParticipantStableState>,
    messages: Vec<Message>,
    last_updated: Timestamp
}

#[derive(CandidType, Deserialize)]
pub struct ParticipantStableState {
    user_id: UserId,
    admin: bool,
    date_added: Timestamp,
    min_visible_message_id: u32,
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
        all_participants.push(Participant::new(creator, true, 1, now));
        for p in participants {
            all_participants.push(Participant::new(p, true, 1, now))
        }

        GroupChat {
            id,
            subject,
            description: None,
            participants: all_participants,
            messages: Vec::new(),
            last_updated: now
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
            self.participants.push(Participant::new(user_to_add, true, self.get_latest_message_id() + 1, now));
            count_added += 1;
        }

        self.last_updated = now;

        Some(count_added)
    }

    pub fn remove_participant(&mut self, requested_by: &UserId, user_to_remove: &UserId, now: Timestamp) -> Option<bool> {
        if !self.is_admin(requested_by) {
            return None;
        }

        let original_count = self.participants.len();
        self.participants.retain(|p| p.user_id != *user_to_remove);
        let new_count = self.participants.len();

        self.last_updated = now;

        Some(new_count < original_count)
    }

    pub fn get_min_visible_message_id(&self, user: &UserId) -> u32 {
        self.find_participant(user).unwrap().min_visible_message_id
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

    fn get_unread_by_any_message_id_ranges<F>(&self, me: &UserId, participant_filter: F) -> Vec<[u32; 2]>
        where F: Fn(&UserId) -> bool {
        let participants: Vec<_> = self.participants
            .iter()
            .filter(|p| participant_filter(&p.user_id))
            .collect();

        let mut range_set = RangeSet::new();
        for participant in participants {
            for range in participant.unread_message_ids.clone().into_smallvec() {
                range_set.insert_range(range);
            }
        }

        let min_visible_message_id = self.get_min_visible_message_id(me);

        range_set.remove_range(0..=(min_visible_message_id - 1));

        utils::range_set_to_vec(range_set)
    }
}

impl Chat for GroupChat {
    fn get_id(&self) -> ChatId {
        self.id
    }

    fn involves_user(&self, user: &UserId) -> bool {
        self.participants.iter().any(|p| p.user_id == *user)
    }

    fn push_message(&mut self, sender: &UserId, client_message_id: String, content: MessageContent, replies_to: Option<ReplyContext>, now: Timestamp) -> u32 {

        let id = match self.messages.last() {
            Some(message) => message.get_id() + 1,
            None => 1
        };

        let message = Message::new(
            id,
            client_message_id,
            now,
            sender.clone(),
            content,
            replies_to
        );

        self.messages.push(message);

        for p in self.participants.iter_mut().filter(|p| p.user_id != *sender) {
            p.unread_message_ids.insert(id);
        }

        self.last_updated = now;

        id
    }

    fn get_messages(&self, user: &UserId, from_id: u32, page_size: u32) -> Vec<Message> {
        get_messages(&self.messages, from_id, page_size, self.get_min_visible_message_id(user))
    }

    fn get_messages_by_id(&self, user: &UserId, ids: Vec<u32>) -> Vec<Message> {
        get_messages_by_id(&self.messages, ids, self.get_min_visible_message_id(user))
    }

    fn get_latest_message_id(&self) -> u32 {
        get_latest_message_id(&self.messages)
    }

    fn search_messages(&self, search_term: &str) -> Vec<Message> {
        search_messages(&self.messages, search_term)
    }

    fn mark_read(&mut self, me: &UserId, from_id: u32, to_id: u32, now: Timestamp) -> MarkReadResult {

        let participant = self
            .participants
            .iter_mut()
            .find(|p| p.user_id == *me)
            .unwrap();

        participant.unread_message_ids.remove_range(from_id..=to_id);

        self.last_updated = now;

        MarkReadResult::new(utils::range_set_to_vec(participant.unread_message_ids.clone()))
    }

    fn get_unread_message_id_ranges(&self, user_id: &UserId) -> Vec<[u32; 2]> {
        let participant = self.participants.iter().find(|p| p.user_id == *user_id).unwrap();

        utils::range_set_to_vec(participant.unread_message_ids.clone())
    }

    fn get_display_date(&self, user_id: &UserId) -> Timestamp {
        let user = self.participants.iter().find(|p| p.user_id == *user_id).unwrap();
        let mut updated_date = user.date_added;

        if let Some(message) = self.messages.last() {
            updated_date = max(updated_date, message.get_timestamp());
        }

        updated_date
    }

    fn get_updated_date(&self) -> Timestamp {
        self.last_updated
    }

    fn to_summary(&self, me: &UserId, message_count: u32) -> ChatSummary {
        ChatSummary::Group(GroupChatSummary::new(self, me, message_count))
    }
}

impl Participant {
    fn new(user_id: UserId, admin: bool, min_visible_message_id: u32, now: Timestamp) -> Participant {
        Participant {
            user_id,
            admin,
            min_visible_message_id,
            date_added: now,
            unread_message_ids: RangeSet::new()
        }
    }
}

impl GroupChatSummary {
    pub fn new(chat: &GroupChat, me: &UserId, message_count: u32) -> GroupChatSummary {
        let unread_by_me_message_id_ranges = chat.get_unread_message_id_ranges(me);
        let unread_by_any_message_id_ranges = chat.get_unread_by_any_message_id_ranges(me, |p: &UserId| p != me);

        let min_visible_message_id = chat.get_min_visible_message_id(me);

        let latest_messages = chat
            .messages
            .iter()
            .rev()
            .take(message_count as usize)
            .take_while(|m| m.get_id() >= min_visible_message_id)
            .map(|m| m.clone())
            .collect();

        GroupChatSummary {
            id: chat.id,
            subject: chat.subject.clone(),
            display_date: chat.get_display_date(me),
            last_updated: chat.last_updated,
            min_visible_message_id: chat.get_min_visible_message_id(me),
            participants: chat.participants.iter().map(|p| p.user_id.clone()).collect(),
            unread_by_me_message_id_ranges,
            unread_by_any_message_id_ranges,
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
            messages: chat.messages,
            last_updated: chat.last_updated
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
            messages: chat.messages,
            last_updated: chat.last_updated
        }
    }
}

impl From<Participant> for ParticipantStableState {
    fn from(participant: Participant) -> Self {
        ParticipantStableState {
            user_id: participant.user_id,
            admin: participant.admin,
            date_added: participant.date_added,
            min_visible_message_id: participant.min_visible_message_id,
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
            min_visible_message_id: participant.min_visible_message_id,
            unread_message_ids: utils::vec_to_range_set(participant.unread_message_ids)
        }
    }
}

impl From<GroupChatStableStatePrevious> for GroupChatStableState {
    fn from(chat: GroupChatStableStatePrevious) -> Self {
        GroupChatStableState {
            id: ChatId(chat.id.0.into()),
            subject: chat.subject,
            description: chat.description,
            participants: chat.participants.into_iter().map(|p| p.into()).collect(),
            messages: chat.messages,
            last_updated: chat.last_updated
        }
    }
}
