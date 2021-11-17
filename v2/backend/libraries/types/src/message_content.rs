use crate::{CanisterId, CryptocurrencyTransfer, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};

const MAX_TEXT_LENGTH: u32 = 5_000;
const MAX_TEXT_LENGTH_USIZE: usize = MAX_TEXT_LENGTH as usize;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Cryptocurrency(CryptocurrencyContent),
    Deleted(DeletedContent),
}

pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
}

impl MessageContent {
    pub fn validate(&self) -> Result<(), ContentValidationError> {
        let (is_empty, text) = match self {
            MessageContent::Text(t) => (t.text.is_empty(), Some(&t.text)),
            MessageContent::Image(i) => (i.blob_reference.is_none(), i.caption.as_ref()),
            MessageContent::Video(v) => (v.video_blob_reference.is_none(), v.caption.as_ref()),
            MessageContent::Audio(a) => (a.blob_reference.is_none(), a.caption.as_ref()),
            MessageContent::File(f) => (f.blob_reference.is_none(), f.caption.as_ref()),
            MessageContent::Cryptocurrency(c) => (c.transfer.is_zero(), c.caption.as_ref()),
            MessageContent::Deleted(_) => (true, None),
        };

        if is_empty {
            Err(ContentValidationError::Empty)
        } else if text.map_or(0, |t| t.len()) > MAX_TEXT_LENGTH_USIZE {
            Err(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH))
        } else {
            Ok(())
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TextContent {
    pub text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ImageContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VideoContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
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
    pub file_size: u32,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptocurrencyContent {
    pub transfer: CryptocurrencyTransfer,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedContent {
    pub deleted_by: UserId,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BlobReference {
    pub canister_id: CanisterId,
    pub blob_id: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ThumbnailData(String);

impl Debug for ThumbnailData {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ThumbnailData").field("byte_length", &self.0.len()).finish()
    }
}
