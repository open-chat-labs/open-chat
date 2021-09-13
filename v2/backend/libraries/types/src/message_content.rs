use crate::CanisterId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Media(MediaContent),
    File(FileContent),
    Cycles(CycleContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TextContent {
    pub text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MediaContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileContent {
    pub name: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CycleContent {
    pub amount: u128,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentType {
    Text,
    Image,
    Video,
    File,
    Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BlobReference {
    pub canister_id: CanisterId,
    pub blob_id: u128,
    pub blob_size: u32,
    pub chunk_size: u32,
}
