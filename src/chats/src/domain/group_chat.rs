use std::cmp::max;
use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use serde::Deserialize;
use super::chat::*;

#[derive(CandidType, Deserialize)]
pub struct Participant {
    principal: Principal,
    latest_read: u32,
}

impl Participant {
    fn new(principal: Principal) -> Participant {
        Participant {
            principal,
            latest_read: 0
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
        participants: Vec<Principal>) -> GroupChat {

        let mut participants: Vec<_> = participants
            .into_iter()
            .map(|p| Participant::new(p))
            .collect();

        participants.push(Participant::new(creator));

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

    fn push_message(&mut self, sender: &Principal, text: String, timestamp: u64) -> u32 {

        let id = match self.messages.last() {
            Some(message) => message.get_id() + 1,
            None => 1
        };

        let message = Message::new(
            id,
            timestamp,
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
        ChatSummary::new(
            self.id,
            me.clone(),
            0,
            self.messages.last().map(|m| m.clone()))
    }
}