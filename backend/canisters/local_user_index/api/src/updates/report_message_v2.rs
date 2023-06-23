use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MessageIndex, MultiUserChat};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: MultiUserChat,
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
