use std::ops::Shl;
use ic_cdk::export::candid::CandidType;
use enum_dispatch::enum_dispatch;
use highway::{HighwayHasher, HighwayHash};
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::domain::direct_chat::{DirectChat, DirectChatSummary, DirectChatStableState, DirectChatStableStatePrevious};
use crate::domain::group_chat::{GroupChat, GroupChatSummary, GroupChatStableState, GroupChatStableStatePrevious};

#[enum_dispatch(Chat)]
pub enum ChatEnum {
    Direct(DirectChat),
    Group(GroupChat)
}

#[enum_dispatch]
pub trait Chat {
    fn get_id(&self) -> ChatId;
    fn involves_user(&self, user: &UserId) -> bool;
    fn push_message(&mut self, sender: &UserId, client_message_id: String, content: MessageContent, replies_to: Option<ReplyContext>, now: Timestamp) -> u32;
    fn get_messages(&self, user: &UserId, from_id: u32, page_size: u32) -> Vec<Message>;
    fn get_messages_by_id(&self, user: &UserId, ids: Vec<u32>) -> Vec<Message>;
    fn get_latest_message_id(&self) -> u32;
    fn search_messages(&self, search_term: &str) -> Vec<Message>;
    fn mark_read(&mut self, me: &UserId, from_id: u32, to_id: u32, now: Timestamp) -> MarkReadResult;
    fn get_unread_message_id_ranges(&self, user: &UserId) -> Vec<[u32; 2]>;
    fn get_display_date(&self, user_id: &UserId) -> Timestamp;
    fn get_updated_date(&self) -> Timestamp;
    fn to_summary(&self, me: &UserId, message_count: u32) -> ChatSummary;
}

#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(pub u128);

#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatIdPrevious(pub u64);

#[derive(CandidType, Deserialize, Clone)]
pub struct TextContent {
    text: String
}

#[derive(CandidType, Deserialize, Clone)]
pub struct MediaContent {
    caption: Option<String>,
    mime_type: String,
    width: u32,
    height: u32,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
    thumbnail_data: String
}

#[derive(CandidType, Deserialize, Clone)]
pub struct FileContent {
    caption: Option<String>,
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
    Cycles(CycleContent)
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    id: u32,
    client_message_id: String,
    timestamp: Timestamp,
    sender: UserId,
    content: MessageContent,
    replies_to: Option<ReplyContext>
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContext {
    chat_id: ChatId,
    user_id: UserId,
    message_id: u32,
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

        let hash_parts = hasher.finalize128();
        let hash1: u128 = hash_parts[0].into();
        let hash2: u128 = hash_parts[1].into();
        let hash: u128 = hash1.shl(64) + hash2;

        ChatId(hash)
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

        let hash_parts = hasher.finalize128();
        let hash1: u128 = hash_parts[0].into();
        let hash2: u128 = hash_parts[1].into();
        let hash: u128 = hash1.shl(64) + hash2;

        ChatId(hash)
    }
}

#[derive(CandidType, Deserialize)]
pub enum ChatStableStatePrevious {
    Direct(DirectChatStableStatePrevious),
    Group(GroupChatStableStatePrevious)
}

impl Message {
    pub fn new(id: u32, client_message_id: String, now: Timestamp, sender: UserId, content: MessageContent, replies_to: Option<ReplyContext>) -> Message {
        Message {
            id,
            client_message_id,
            timestamp: now,
            sender,
            content,
            replies_to
        }
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub fn get_timestamp(&self) -> Timestamp {
        self.timestamp
    }

    pub fn matches_search(&self, search_term: &str) -> bool {

        fn text_matches(text: &Option<String>, search_term: &str) -> bool {
            text.is_some() && text.as_ref().unwrap().to_lowercase().contains(search_term)
        }

        let search_term = &search_term.to_lowercase();
        match &self.content {
            MessageContent::Text(t) => t.text.to_lowercase().contains(search_term),
            MessageContent::Media(m) => text_matches(&m.caption, search_term),
            MessageContent::File(f) => text_matches(&f.caption, search_term) || f.name.to_lowercase().contains(search_term),
            MessageContent::Cycles(c) => text_matches(&c.caption, search_term)
        }
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

impl From<ChatStableStatePrevious> for ChatStableState {
    fn from(chat: ChatStableStatePrevious) -> Self {
        match chat {
            ChatStableStatePrevious::Direct(c) => ChatStableState::Direct(c.into()),
            ChatStableStatePrevious::Group(c) => ChatStableState::Group(c.into())
        }
    }
}

impl CycleContent {
    pub fn get_amount(&self) -> u128 {
        self.amount
    }
}