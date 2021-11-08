use super::chat::*;
use super::messages::*;
use crate::utils;
use ic_cdk::export::candid::CandidType;
use range_set::RangeSet;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use std::cmp::max;
use std::ops::RangeInclusive;

pub struct GroupChat {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<Participant>,
    messages: Vec<Message>,
    chat_history_visible_to_new_joiners: bool,
    last_updated: Timestamp,
}

pub struct Participant {
    user_id: UserId,
    admin: bool,
    date_added: Timestamp,
    min_visible_message_id: u32,
    unread_message_ids: RangeSet<[RangeInclusive<u32>; 2]>,
    notifications_muted: bool,
}

#[derive(CandidType)]
pub struct GroupChatSummary {
    id: ChatId,
    subject: String,
    display_date: Timestamp,
    last_updated: Timestamp,
    chat_history_visible_to_new_joiners: bool,
    min_visible_message_id: u32,
    participants: Vec<UserId>,
    unread_by_me_message_id_ranges: Vec<[u32; 2]>,
    unread_by_any_message_id_ranges: Vec<[u32; 2]>,
    latest_messages: Vec<Message>,
    muted: bool,
}

#[derive(CandidType, Deserialize)]
pub struct GroupChatStableState {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<ParticipantStableState>,
    messages: Vec<Message>,
    chat_history_visible_to_new_joiners: Option<bool>,
    last_updated: Timestamp,
}

#[derive(CandidType, Deserialize)]
pub struct ParticipantStableState {
    user_id: UserId,
    admin: bool,
    date_added: Timestamp,
    min_visible_message_id: u32,
    unread_message_ids: Vec<[u32; 2]>,
    notifications_muted: bool,
}

impl GroupChat {
    pub fn new(
        id: ChatId,
        subject: String,
        creator: UserId,
        participants: Vec<UserId>,
        chat_history_visible_to_new_joiners: bool,
        now: Timestamp,
    ) -> GroupChat {
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
            chat_history_visible_to_new_joiners,
            last_updated: now,
        }
    }

    pub fn add_participant(&mut self, user_to_add: UserId, now: Timestamp) -> bool {
        if self.find_participant(&user_to_add).is_some() {
            false
        } else {
            self.participants.push(Participant::new(
                user_to_add,
                true,
                self.get_latest_message_id() + 1,
                now,
            ));
            self.last_updated = now;
            true
        }
    }

    pub fn remove_participant(&mut self, user_to_remove: &UserId, now: Timestamp) -> bool {
        let original_count = self.participants.len();
        self.participants.retain(|p| p.user_id != *user_to_remove);
        let new_count = self.participants.len();
        self.last_updated = now;
        new_count < original_count
    }

    pub fn get_min_visible_message_id(&self, user: &UserId) -> u32 {
        if self.chat_history_visible_to_new_joiners {
            1
        } else {
            self.find_participant(user).unwrap().min_visible_message_id
        }
    }

    pub fn is_admin(&self, user: &UserId) -> bool {
        match self.find_participant(user) {
            Some(p) => p.admin,
            None => false,
        }
    }

    pub fn get_admin_count(&self) -> usize {
        self.participants.iter().map(|p| p.admin).len()
    }

    pub fn leave(&mut self, user_to_remove: &UserId, now: Timestamp) -> Option<bool> {
        let original_count = self.participants.len();

        if (self.is_admin(user_to_remove) && self.get_admin_count() == 1) || original_count == 1 {
            // Cannot leave the group if you are the last admin or the last participant (this should not happen)
            return None;
        }

        self.participants.retain(|p| p.user_id != *user_to_remove);
        self.last_updated = now;
        let new_count = self.participants.len();

        Some(new_count < original_count)
    }

    pub fn is_user_in_group(&self, user_id: &UserId) -> bool {
        self.find_participant(user_id).is_some()
    }

    pub fn iter_participants(&self) -> impl Iterator<Item = &UserId> {
        self.participants.iter().map(|p| &p.user_id)
    }

    pub fn subject(&self) -> &String {
        &self.subject
    }

    pub fn notification_recipients(&self, sender: UserId) -> Vec<UserId> {
        self.participants
            .iter()
            .filter(|p| !p.notifications_muted && p.user_id != sender)
            .map(|p| p.user_id())
            .collect()
    }

    pub fn notifications_muted(&self, user_id: UserId) -> bool {
        if let Some(participant) = self.find_participant(&user_id) {
            participant.notifications_muted
        } else {
            false
        }
    }

    fn find_participant(&self, user_id: &UserId) -> Option<&Participant> {
        self.participants.iter().find(|p| p.user_id == *user_id)
    }

    // fn get_unread_by_any_message_id_ranges<F>(&self, me: &UserId, participant_filter: F) -> Vec<[u32; 2]>
    //     where F: Fn(&UserId) -> bool {
    //     let participants: Vec<_> = self.participants
    //         .iter()
    //         .filter(|p| participant_filter(&p.user_id))
    //         .collect();

    //     let mut range_set = RangeSet::new();
    //     for participant in participants {
    //         for range in participant.unread_message_ids.clone().into_smallvec() {
    //             range_set.insert_range(range);
    //         }
    //     }

    //     let min_visible_message_id = self.get_min_visible_message_id(me);

    //     range_set.remove_range(0..=(min_visible_message_id - 1));

    //     utils::range_set_to_vec(range_set)
    // }
}

impl Chat for GroupChat {
    fn get_id(&self) -> ChatId {
        self.id
    }

    fn involves_user(&self, user: &UserId) -> bool {
        self.participants.iter().any(|p| p.user_id == *user)
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

        for p in self
            .participants
            .iter_mut()
            .filter(|p| p.user_id != *sender)
        {
            p.unread_message_ids.insert(id);
        }

        self.last_updated = now;

        message
    }

    fn get_messages(&self, user: &UserId, from_id: u32, page_size: u32) -> Vec<Message> {
        get_messages(
            &self.messages,
            from_id,
            page_size,
            self.get_min_visible_message_id(user),
        )
    }

    fn get_messages_by_id(&self, user: &UserId, ids: Vec<u32>) -> Vec<Message> {
        get_messages_by_id(&self.messages, ids, self.get_min_visible_message_id(user))
    }

    fn get_message_mut(&mut self, id: u32) -> Option<&mut Message> {
        self.messages.get_mut((id - 1) as usize)
    }

    fn get_latest_message_id(&self) -> u32 {
        get_latest_message_id(&self.messages)
    }

    fn search_messages(&self, search_term: &str, user_id: &UserId) -> Vec<Message> {
        let min_visible_message_id = self
            .participants
            .iter()
            .find(|p| p.user_id == *user_id)
            .unwrap()
            .min_visible_message_id;

        let range_start = (min_visible_message_id - 1) as usize;

        search_messages(&self.messages[range_start..], search_term)
    }

    fn mark_read(
        &mut self,
        me: &UserId,
        from_id: u32,
        to_id: u32,
        now: Timestamp,
    ) -> MarkReadResult {
        let participant = self
            .participants
            .iter_mut()
            .find(|p| p.user_id == *me)
            .unwrap();

        participant.unread_message_ids.remove_range(from_id..=to_id);

        self.last_updated = now;

        MarkReadResult::new(utils::range_set_to_vec(
            participant.unread_message_ids.clone(),
        ))
    }

    fn mute_notifications(&mut self, user_id: UserId, mute: bool) {
        if let Some(participant) = self.participants.iter_mut().find(|p| p.user_id == user_id) {
            participant.notifications_muted = mute;
        }
    }

    fn get_unread_message_id_ranges(&self, user_id: &UserId) -> Vec<[u32; 2]> {
        let participant = self
            .participants
            .iter()
            .find(|p| p.user_id == *user_id)
            .unwrap();

        utils::range_set_to_vec(participant.unread_message_ids.clone())
    }

    fn get_display_date(&self, user_id: &UserId) -> Timestamp {
        let user = self
            .participants
            .iter()
            .find(|p| p.user_id == *user_id)
            .unwrap();
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
    fn new(
        user_id: UserId,
        admin: bool,
        min_visible_message_id: u32,
        now: Timestamp,
    ) -> Participant {
        Participant {
            user_id,
            admin,
            min_visible_message_id,
            date_added: now,
            unread_message_ids: RangeSet::new(),
            notifications_muted: false,
        }
    }

    pub fn user_id(&self) -> UserId {
        self.user_id
    }
}

impl GroupChatSummary {
    pub fn new(chat: &GroupChat, me: &UserId, message_count: u32) -> GroupChatSummary {
        let unread_by_me_message_id_ranges = chat.get_unread_message_id_ranges(me);
        let unread_by_any_message_id_ranges = Vec::new(); //chat.get_unread_by_any_message_id_ranges(me, |p: &UserId| p != me);

        let min_visible_message_id = chat.get_min_visible_message_id(me);

        let latest_messages = chat
            .messages
            .iter()
            .rev()
            .take(message_count as usize)
            .take_while(|m| m.get_id() >= min_visible_message_id)
            .cloned()
            .collect();

        GroupChatSummary {
            id: chat.id,
            subject: chat.subject.clone(),
            display_date: chat.get_display_date(me),
            last_updated: chat.last_updated,
            chat_history_visible_to_new_joiners: chat.chat_history_visible_to_new_joiners,
            min_visible_message_id: chat.get_min_visible_message_id(me),
            participants: chat.participants.iter().map(|p| p.user_id).collect(),
            unread_by_me_message_id_ranges,
            unread_by_any_message_id_ranges,
            latest_messages,
            muted: chat.notifications_muted(*me),
        }
    }
}

impl GroupChatStableState {
    pub fn get_id(&self) -> ChatId {
        self.id
    }

    pub fn iter_participants(&self) -> impl Iterator<Item = &UserId> {
        self.participants.iter().map(|p| &p.user_id)
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
            chat_history_visible_to_new_joiners: Some(chat.chat_history_visible_to_new_joiners),
            last_updated: chat.last_updated,
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
            chat_history_visible_to_new_joiners: chat
                .chat_history_visible_to_new_joiners
                .unwrap_or(false),
            last_updated: chat.last_updated,
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
            unread_message_ids: utils::range_set_to_vec(participant.unread_message_ids),
            notifications_muted: participant.notifications_muted,
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
            unread_message_ids: utils::vec_to_range_set(participant.unread_message_ids),
            notifications_muted: participant.notifications_muted,
        }
    }
}
