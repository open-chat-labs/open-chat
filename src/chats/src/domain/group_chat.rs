use std::cmp::max;
use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use super::chat::*;

#[derive(CandidType, Deserialize)]
struct Participant {
    principal: Principal,
    latest_read: u32,
    date_added: Timestamp
}

impl Participant {
    fn new(principal: Principal, now: Timestamp) -> Participant {
        Participant {
            principal,
            latest_read: 0,
            date_added: now
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct GroupChat {
    id: ChatId,
    subject: String,
    description: Option<String>,
    participants: Vec<Participant>,
    messages: Vec<Message>
}

impl GroupChat {
    pub fn new(
        id: ChatId,
        subject: String,
        creator: Principal,
        participants: Vec<Principal>,
        now: Timestamp) -> GroupChat {

        let mut participants: Vec<_> = participants
            .into_iter()
            .map(|p| Participant::new(p, now))
            .collect();

        participants.push(Participant::new(creator, now));

        GroupChat {
            id,
            subject,
            description: None,
            participants,
            messages: Vec::new()
        }
    }
}

impl Chat for GroupChat {
    fn get_id(&self) -> ChatId {
        self.id
    }

    fn involves_user(&self, user: &Principal) -> bool {
        self.participants.iter().any(|p| p.principal == *user)
    }

    fn push_message(&mut self, sender: &Principal, text: String, now: Timestamp) -> u32 {

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
            .find(|p| p.principal == *sender)
            .unwrap();

        if participant.latest_read == id - 1 {
            participant.latest_read = id;
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

        let participant = self
            .participants
            .iter_mut()
            .find(|p| p.principal == *me)
            .unwrap();

        let latest_id = self.messages.last().unwrap().get_id();

        let up_to_id = max(up_to_id, latest_id);

        if participant.latest_read < up_to_id {
            participant.latest_read = up_to_id;
        }

        latest_id
    }

    fn to_summary(&self, me: &Principal) -> ChatSummary {
        ChatSummary::Group(GroupChatSummary::new(self, me))
    }
}

#[derive(CandidType)]
pub struct GroupChatSummary {
    id: ChatId,
    subject: String,
    updated_date: Timestamp,
    participants: Vec<Principal>,
    unread: u32,
    latest_message: Option<Message>
}

impl GroupChatSummary {
    fn new(chat: &GroupChat, me: &Principal) -> GroupChatSummary {

        let me = chat.participants.iter().find(|p| p.principal == *me).unwrap();

        fn calc_updated_date(chat: &GroupChat, me: &Participant) -> Timestamp {
            let mut updated_date = me.date_added;

            if let Some(message) = chat.messages.last() {
                updated_date = max(updated_date, message.get_timestamp());
            }

            updated_date
        }

        let latest_message = chat.messages.last();

        let unread = if let Some(message) = latest_message {
            message.get_id() - me.latest_read
        } else {
            0
        };

        GroupChatSummary {
            id: chat.id,
            subject: chat.subject.clone(),
            updated_date: calc_updated_date(chat, me),
            participants: chat.participants.iter().map(|p| p.principal.clone()).collect(),
            unread,
            latest_message: latest_message.map(|m| m.clone())
        }
    }

    pub fn get_updated_date(&self) -> Timestamp {
        self.updated_date
    }
}