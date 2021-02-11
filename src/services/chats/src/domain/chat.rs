use ic_cdk::export::candid::CandidType;
use enum_dispatch::enum_dispatch;
use highway::{HighwayHasher, HighwayHash};
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::domain::direct_chat::{DirectChat, DirectChatSummary, DirectChatStableState};
use crate::domain::group_chat::{GroupChat, GroupChatSummary, GroupChatStableState};

#[enum_dispatch(Chat)]
pub enum ChatEnum {
    Direct(DirectChat),
    Group(GroupChat)
}

#[enum_dispatch]
pub trait Chat {
    fn get_id(&self) -> ChatId;
    fn involves_user(&self, user: &UserId) -> bool;
    fn push_message(&mut self, sender: &UserId, client_message_id: String, content: MessageContent, now: Timestamp) -> u32;
    fn get_messages(&self, user: &UserId, from_id: u32, page_size: u32) -> Vec<Message>;
    fn get_messages_by_id(&self, user: &UserId, ids: Vec<u32>) -> Vec<Message>;
    fn get_latest_message_id(&self) -> u32;
    fn mark_read(&mut self, me: &UserId, from_id: u32, to_id: u32, now: Timestamp) -> MarkReadResult;
    fn get_unread_message_id_ranges(&self, user: &UserId) -> Vec<[u32; 2]>;
    fn get_display_date(&self, user_id: &UserId) -> Timestamp;
    fn get_updated_date(&self) -> Timestamp;
    fn to_summary(&self, me: &UserId, message_count: u32) -> ChatSummary;
}

/// TODO: We would preferably use a Uuid or u128 but these haven't yet got a CandidType implementation
#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(pub u64);

#[derive(CandidType, Deserialize, Clone)]
pub struct TextContent {
    text: String
}

#[derive(CandidType, Deserialize, Clone)]
pub struct MediaContent {
    caption: Option<String>,
    mime_type: String,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32
}

#[derive(CandidType, Deserialize, Clone)]
pub struct FileContent {
    name: String,
    mime_type: String,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CycleContent {
    amount: u128,
    caption: Option<String>
}

#[derive(CandidType, Deserialize, Clone)]
pub enum MessageContent {
    Text(TextContent),
    Media(MediaContent),
    File(FileContent),
    Cycles(CycleContent),
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    id: u32,
    client_message_id: String,
    timestamp: Timestamp,
    sender: UserId,
    content: MessageContent
}

#[derive(CandidType)]
pub enum ChatSummary {
    Direct(DirectChatSummary),
    Group(GroupChatSummary)
}

#[derive(CandidType)]
pub struct MarkReadResult {
    unread_message_id_ranges: Vec<[u32; 2]>
}

#[derive(CandidType, Deserialize)]
pub enum ChatStableState {
    Direct(DirectChatStableState),
    Group(GroupChatStableState)
}

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

impl Message {
    pub fn new(id: u32, client_message_id: String, now: Timestamp, sender: UserId, content: MessageContent) -> Message {
        Message {
            id,
            client_message_id,
            timestamp: now,
            sender,
            content
        }
    }

    pub fn get_timestamp(&self) -> Timestamp {
        self.timestamp
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }
}

impl MarkReadResult {
    pub fn new(unread_message_id_ranges: Vec<[u32; 2]>) -> MarkReadResult {
        MarkReadResult {
            unread_message_id_ranges
        }
    }
}

impl ChatStableState {
    pub fn get_id(&self) -> ChatId {
        match self {
            ChatStableState::Direct(c) => c.get_id(),
            ChatStableState::Group(c) => c.get_id()
        }
    }
}

impl From<ChatStableState> for ChatEnum {
    fn from(chat: ChatStableState) -> Self {
        match chat {
            ChatStableState::Direct(c) => ChatEnum::Direct(c.into()),
            ChatStableState::Group(c) => ChatEnum::Group(c.into())
        }
    }
}

impl From<ChatEnum> for ChatStableState {
    fn from(chat: ChatEnum) -> Self {
        match chat {
            ChatEnum::Direct(c) => ChatStableState::Direct(c.into()),
            ChatEnum::Group(c) => ChatStableState::Group(c.into())
        }
    }
}

impl CycleContent {
    pub fn get_amount(&self) -> u128 {
        self.amount
    }
}