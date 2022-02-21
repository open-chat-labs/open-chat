use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageContent, MessageId, MessageIndex, ReplyContext};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    InsufficientCycles,
}
