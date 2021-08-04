use crate::common::reply_context_internal::ReplyContextInternal;
use candid::CandidType;
use serde::Deserialize;
use shared::types::message_content::MessageContent;
use shared::types::MessageId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub message_id: MessageId,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
