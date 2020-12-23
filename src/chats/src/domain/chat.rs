use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use enum_dispatch::enum_dispatch;
use highway::{HighwayHasher, HighwayHash};
use serde::Deserialize;
use crate::domain::direct_chat::DirectChat;
use crate::domain::group_chat::GroupChat;

#[enum_dispatch(Chat)]
#[derive(CandidType, Deserialize)]
pub enum ChatEnum {
    Direct(DirectChat),
    Group(GroupChat)
}

#[enum_dispatch]
pub trait Chat {
    fn get_id(&self) -> ChatId;
    fn involves_user(&self, user: &Principal) -> bool;
    fn push_message(&mut self, sender: &Principal, text: String, timestamp: u64) -> u32;
    fn get_messages(&self, from_id: u32) -> Vec<Message>;
    fn mark_read(&mut self, me: &Principal, up_to_id: u32) -> u32;
    fn to_summary(&self, me: &Principal) -> ChatSummary;
}

/// TODO: We would preferably use a Uuid or u128 but these haven't yet got a CandidType implementation
#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(u64);

impl ChatId {

    pub fn for_group_chat(creator: &Principal, timestamp: u64) -> ChatId {
        let mut hasher = HighwayHasher::default();

        hasher.append(creator.as_slice());
        hasher.append(&timestamp.to_be_bytes());

        ChatId(hasher.finalize64())
    }

    pub fn for_direct_chat(user1: &Principal, user2: &Principal) -> ChatId {
        let mut hasher = HighwayHasher::default();

        if user1 < user2 {
            hasher.append(user1.as_slice());
            hasher.append(user2.as_slice());
        } else {
            hasher.append(user2.as_slice());
            hasher.append(user1.as_slice());
        }

        ChatId(hasher.finalize64())
    }
}

#[derive(CandidType)]
pub struct ChatSummary {
    id: ChatId,
    them: Principal,
    unread: u32,
    most_recent: Option<Message>
}

impl ChatSummary {
    pub fn new(id: ChatId, them: Principal, unread: u32, most_recent: Option<Message>) -> ChatSummary {
        ChatSummary { id, them, unread, most_recent }
    }

    pub fn get_most_recent(&self) -> Option<&Message> {
        self.most_recent.as_ref()
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    id: u32,
    timestamp: u64,
    sender: Principal,
    text: String
}

impl Message {
    pub fn new(id: u32, timestamp: u64, sender: Principal, text: String) -> Message {
        Message {
            id,
            timestamp,
            sender,
            text
        }
    }

    pub fn get_timestamp(&self) -> u64 {
        self.timestamp
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }
}