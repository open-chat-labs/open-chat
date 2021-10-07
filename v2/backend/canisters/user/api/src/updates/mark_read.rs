use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, MessageIndexRange};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub messages_read: Vec<ChatMessagesRead>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ChatMessagesRead {
    pub chat_id: ChatId,
    pub message_ranges: Vec<MessageIndexRange>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
