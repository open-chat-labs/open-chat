use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, EventIndex, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
