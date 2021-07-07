use crate::types::CanisterId;
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
    width: u32,
    height: u32,
    thumbnail_data: String,
    caption: Option<String>,
    mime_type: String,
    blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct FileContent {
    name: String,
    caption: Option<String>,
    mime_type: String,
    blob_reference: Option<BlobReference>,
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

#[derive(CandidType, Deserialize, Clone)]
pub struct BlobReference {
    canister_id: CanisterId,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
}
