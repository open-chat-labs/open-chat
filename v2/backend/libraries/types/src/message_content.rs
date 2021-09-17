use crate::CanisterId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Cycles(CycleContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TextContent {
    pub text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ImageContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VideoContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub image_blob_reference: Option<BlobReference>,
    pub video_blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AudioContent {
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
}
