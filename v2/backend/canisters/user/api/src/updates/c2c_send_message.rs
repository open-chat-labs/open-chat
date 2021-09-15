use candid::CandidType;
use serde::Deserialize;
use types::{DirectReplyContextInternal, MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<DirectReplyContextInternal>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}
