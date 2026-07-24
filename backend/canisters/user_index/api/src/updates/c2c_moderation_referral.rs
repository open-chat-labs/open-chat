use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BlobReference, Chat, MessageId, MessageIndex, UnitResult, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    // The categories which scored above the referral threshold
    pub flags: u32,
    pub content_excerpt: Option<String>,
    // The message's media attachments, retained on the report in case the human verdict is
    // UpheldAsCsam (which quarantines them)
    pub blob_references: Vec<BlobReference>,
}

pub type Response = UnitResult;
