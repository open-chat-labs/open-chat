use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, EventIndex, MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to_v2: Option<C2CReplyContext>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    InsufficientCycles,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum C2CReplyContext {
    ThisChat(MessageId),
    OtherChat(ChatId, EventIndex),
}
