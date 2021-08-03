use crate::time::TimestampMillis;
use crate::types::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(pub u128);

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct TextContent {
    text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct MediaContent {
    caption: Option<String>,
    mime_type: String,
    width: u32,
    height: u32,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
    thumbnail_data: String,
    blob_deleted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct FileContent {
    caption: Option<String>,
    name: String,
    mime_type: String,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
    blob_deleted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CycleContent {
    amount: u128,
    caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum MessageContent {
    Text(TextContent),
    Media(MediaContent),
    File(FileContent),
    Cycles(CycleContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum MessageContentType {
    Text,
    Image,
    Video,
    File,
    Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Message {
    id: u32,
    client_message_id: String,
    timestamp: TimestampMillis,
    sender: UserId,
    content: MessageContent,
    replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ReplyContext {
    chat_id: ChatId,
    user_id: UserId,
    message_id: u32,
    content: MessageContent,
}
