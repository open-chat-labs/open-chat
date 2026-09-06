use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BlobReference, ChannelId, MessageId, MessageIndex, UnitResult, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Set when the caller is a community canister, identifying the channel within it
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub flags: u32,
    pub content_excerpt: Option<String>,
    // The message's media attachments, so the evidence vault can quarantine them
    #[serde(default)]
    pub blob_references: Vec<BlobReference>,
    // Present when the detection was a media hash match rather than the text classifier
    #[serde(default)]
    pub media_matches: Vec<types::MediaScanMatch>,
}

pub type Response = UnitResult;
