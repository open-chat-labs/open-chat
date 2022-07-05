use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, MessageIndex, MessageIndexRange};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages_read: Vec<ChatMessagesRead>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChatMessagesRead {
    pub chat_id: ChatId,
    pub message_ranges: Vec<MessageIndexRange>,
    pub threads: Vec<ThreadRead>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadRead {
    pub root_message_index: MessageIndex,
    pub latest_message_read: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
