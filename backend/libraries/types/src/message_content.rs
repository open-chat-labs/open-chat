use crate::polls::{AnonymousPollVotes, InvalidPollReason, PollConfig, PollVotes};
use crate::ContentValidationError::InvalidPoll;
use crate::{CanisterId, CryptocurrencyTransfer, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    Poll(PollContent),
    Cryptocurrency(CryptocurrencyContent),
    Deleted(DeletedContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentInternal {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContentInternal),
    Cryptocurrency(CryptocurrencyContent),
    Deleted(DeletedContent),
}

pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
}

impl MessageContent {
    // Determines if the content is valid for a new message, this should not be called on existing
    // messages
    pub fn validate_for_new_message(&self, now: TimestampMillis) -> Result<(), ContentValidationError> {
        if let MessageContent::Poll(p) = self {
            if let Err(reason) = p.config.validate(now) {
                return Err(InvalidPoll(reason));
            }
        }

        let is_empty = match self {
            MessageContent::Text(t) => t.text.is_empty(),
            MessageContent::Image(i) => i.blob_reference.is_none(),
            MessageContent::Video(v) => v.video_blob_reference.is_none(),
            MessageContent::Audio(a) => a.blob_reference.is_none(),
            MessageContent::File(f) => f.blob_reference.is_none(),
            MessageContent::Poll(p) => p.config.options.is_empty(),
            MessageContent::Cryptocurrency(c) => c.transfer.is_zero(),
            MessageContent::Deleted(_) => true,
        };

        if is_empty {
            Err(ContentValidationError::Empty)
        } else if self.text_length() > MAX_TEXT_LENGTH_USIZE {
            Err(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH))
        } else {
            Ok(())
        }
    }

    // This must only be called on the content of new messages, this is because for polls it will
    // set the votes to empty
    pub fn new_content_into_internal(self) -> MessageContentInternal {
        match self {
            MessageContent::Text(t) => MessageContentInternal::Text(t),
            MessageContent::Image(i) => MessageContentInternal::Image(i),
            MessageContent::Video(v) => MessageContentInternal::Video(v),
            MessageContent::Audio(a) => MessageContentInternal::Audio(a),
            MessageContent::File(f) => MessageContentInternal::File(f),
            MessageContent::Poll(p) => MessageContentInternal::Poll(PollContentInternal {
                config: p.config,
                votes: HashMap::new(),
                ended: false,
            }),
            MessageContent::Cryptocurrency(c) => MessageContentInternal::Cryptocurrency(c),
            MessageContent::Deleted(d) => MessageContentInternal::Deleted(d),
        }
    }

    pub fn blob_references(&self) -> Vec<BlobReference> {
        let mut references = Vec::new();

        match self {
            MessageContent::Image(i) => {
                if let Some(br) = i.blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContent::Video(v) => {
                if let Some(br) = v.video_blob_reference.clone() {
                    references.push(br);
                }
                if let Some(br) = v.image_blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContent::Audio(a) => {
                if let Some(br) = a.blob_reference.clone() {
                    references.push(br)
                }
            }
            MessageContent::File(f) => {
                if let Some(br) = f.blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContent::Text(_)
            | MessageContent::Poll(_)
            | MessageContent::Cryptocurrency(_)
            | MessageContent::Deleted(_) => {}
        }

        references
    }

    fn text_length(&self) -> usize {
        match self {
            MessageContent::Text(t) => t.text.len(),
            MessageContent::Image(i) => i.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Video(v) => v.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Audio(a) => a.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::File(f) => f.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Poll(p) => p.config.text.as_ref().map_or(0, |t| t.len()),
            MessageContent::Cryptocurrency(c) => c.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Deleted(_) => 0,
        }
    }
}

impl MessageContentInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> MessageContent {
        match self {
            MessageContentInternal::Text(t) => MessageContent::Text(t.clone()),
            MessageContentInternal::Image(i) => MessageContent::Image(i.clone()),
            MessageContentInternal::Video(v) => MessageContent::Video(v.clone()),
            MessageContentInternal::Audio(a) => MessageContent::Audio(a.clone()),
            MessageContentInternal::File(f) => MessageContent::File(f.clone()),
            MessageContentInternal::Poll(p) => MessageContent::Poll(p.hydrate(my_user_id)),
            MessageContentInternal::Cryptocurrency(c) => MessageContent::Cryptocurrency(c.clone()),
            MessageContentInternal::Deleted(d) => MessageContent::Deleted(d.clone()),
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
pub struct PollContent {
    pub config: PollConfig,
    pub votes: PollVotes,
}

impl PollContent {
    pub fn initialize_votes(&mut self) {
        if self.config.anonymous {
            self.votes = PollVotes::Anonymous(AnonymousPollVotes::default());
        } else if self.config.end_date.is_some() && !self.config.show_votes_before_end_date {
            self.votes = PollVotes::Hidden(0);
        } else {
            self.votes = PollVotes::Visible(HashMap::new());
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollContentInternal {
    pub config: PollConfig,
    pub votes: HashMap<u32, Vec<UserId>>,
    pub ended: bool,
}

impl PollContentInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> PollContent {
        let votes: PollVotes;
        let show_votes = self.config.end_date.is_none() || self.ended || self.config.show_votes_before_end_date;
        if !show_votes {
            votes = PollVotes::Hidden(self.votes.values().map(|v| v.len() as u32).sum());
        } else if self.config.anonymous {
            let user_votes = if let Some(user_id) = my_user_id {
                self.votes
                    .iter()
                    .filter(|(_, v)| v.contains(&user_id))
                    .map(|(k, _)| *k)
                    .collect()
            } else {
                Vec::new()
            };

            votes = PollVotes::Anonymous(AnonymousPollVotes {
                totals: self.votes.iter().map(|(k, v)| (*k, v.len() as u32)).collect(),
                user_votes,
            });
        } else {
            votes = PollVotes::Visible(self.votes.clone());
        }

        PollContent {
            config: self.config.clone(),
            votes,
        }
    }
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
