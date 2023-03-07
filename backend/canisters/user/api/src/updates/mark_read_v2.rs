use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages_read: Vec<ChatMessagesRead>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChatMessagesRead {
    pub chat_id: ChatId,
    pub read_up_to: Option<MessageIndex>,
    pub threads: Vec<ThreadRead>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadRead {
    pub root_message_index: MessageIndex,
    pub read_up_to: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
