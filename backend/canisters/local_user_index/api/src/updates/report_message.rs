use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, EventIndex, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
