use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub enum MessageContent {
    Text(TextContent),
    Media(MediaContent),
    File(FileContent),
    Cycles(CycleContent),
}

#[derive(CandidType, Deserialize, Clone)]
pub struct TextContent {
    text: String,
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
    thumbnail_data: String,
    blob_deleted: bool,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct FileContent {
    caption: Option<String>,
    name: String,
    mime_type: String,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
    blob_deleted: bool,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CycleContent {
    amount: u128,
    caption: Option<String>,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum MessageContentType {
    Text,
    Image,
    Video,
    File,
    Cycles,
}
