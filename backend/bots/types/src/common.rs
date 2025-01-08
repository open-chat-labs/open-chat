use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

pub type CanisterId = Principal;
pub type TimestampMillis = u64;
pub type TimestampNanos = u64;
pub type Milliseconds = u64;
pub type Nanoseconds = u64;
pub type MessageId = String; // u128 encoded as string
pub type Hash = [u8; 32];

#[derive(CandidType, Serialize, Deserialize)]
pub struct MessageIndex(u32);

#[derive(CandidType, Serialize, Deserialize)]
pub struct UserId(CanisterId);

impl Display for UserId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

#[derive(Serialize, Deserialize)]
pub enum StringChat {
    Direct(String),
    Group(String),
    Channel(String, String),
}

#[derive(CandidType, Serialize, Clone)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Giphy(GiphyContent),
}

#[derive(CandidType, Serialize, Clone)]
pub struct TextContent {
    pub text: String,
}

impl From<String> for TextContent {
    fn from(value: String) -> Self {
        TextContent { text: value }
    }
}

#[derive(CandidType, Serialize, Clone)]
pub struct ImageContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Clone)]
pub struct GiphyImageVariant {
    pub width: u32,
    pub height: u32,
    pub url: String,
    pub mime_type: String,
}

#[derive(CandidType, Serialize, Clone)]
pub struct GiphyContent {
    pub caption: Option<String>,
    pub title: String,
    pub desktop: GiphyImageVariant,
    pub mobile: GiphyImageVariant,
}

#[derive(CandidType, Serialize, Clone)]
pub struct VideoContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
    pub caption: Option<String>,
    pub mime_type: String,
    pub image_blob_reference: Option<BlobReference>,
    pub video_blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Clone)]
pub struct AudioContent {
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Clone)]
pub struct FileContent {
    pub name: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub file_size: u32,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Clone)]
pub struct PollContent {
    pub config: PollConfig,
}

#[derive(CandidType, Serialize, Clone, Debug)]
pub struct PollConfig {
    pub text: Option<String>,
    pub options: Vec<String>,
    pub end_date: Option<TimestampMillis>,
    pub anonymous: bool,
    pub show_votes_before_end_date: bool,
    pub allow_multiple_votes_per_user: bool,
    pub allow_user_to_change_vote: bool,
}

#[derive(CandidType, Serialize, Clone)]
pub struct ThumbnailData(pub String);

#[derive(CandidType, Serialize, Clone)]
pub struct BlobReference {
    pub canister_id: Principal,
    pub blob_id: u128,
}
