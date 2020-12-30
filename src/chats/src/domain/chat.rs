use ic_cdk::export::candid::CandidType;
use enum_dispatch::enum_dispatch;
use highway::{HighwayHasher, HighwayHash};
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::domain::direct_chat::{DirectChat, DirectChatSummary};
use crate::domain::group_chat::{GroupChat, GroupChatSummary};

#[enum_dispatch(Chat)]
#[derive(CandidType, Deserialize)]
pub enum ChatEnum {
    Direct(DirectChat),
    Group(GroupChat)
}

#[enum_dispatch]
pub trait Chat {
    fn get_id(&self) -> ChatId;
    fn involves_user(&self, user: &UserId) -> bool;
    fn push_message(&mut self, sender: &UserId, text: String, timestamp: Timestamp) -> u32;
    fn get_messages(&self, from_id: u32, page_size: u32) -> Vec<Message>;
    fn mark_read(&mut self, me: &UserId, up_to_id: u32) -> u32;
    fn get_unread_count(&self, user: &UserId) -> u32;
    fn to_summary(&self, me: &UserId) -> ChatSummary;
}

/// TODO: We would preferably use a Uuid or u128 but these haven't yet got a CandidType implementation
#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(u64);

impl ChatId {

    pub fn for_group_chat(creator: &UserId, timestamp: Timestamp) -> ChatId {
        let mut hasher = HighwayHasher::default();

        hasher.append(creator.as_slice());
        hasher.append(&timestamp.to_be_bytes());

        ChatId(hasher.finalize64())
    }

    pub fn for_direct_chat(user1: &UserId, user2: &UserId) -> ChatId {
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
pub enum ChatSummary {
    Direct(DirectChatSummary),
    Group(GroupChatSummary)
}

impl ChatSummary {
    // Date bumped by:
    // 1 - New message from any user
    // 2 - Group created with 'me' in it
    // 3 - 'me' added to existing group
    pub fn get_updated_date(&self) -> Timestamp {
        match self {
            ChatSummary::Direct(summary) => summary.get_updated_date(),
            ChatSummary::Group(summary) => summary.get_updated_date()
        }
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    id: u32,
    timestamp: Timestamp,
    sender: UserId,
    text: String
}

impl Message {
    pub fn new(id: u32, now: Timestamp, sender: UserId, text: String) -> Message {
        Message {
            id,
            timestamp: now,
            sender,
            text
        }
    }

    pub fn get_timestamp(&self) -> Timestamp {
        self.timestamp
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }
}