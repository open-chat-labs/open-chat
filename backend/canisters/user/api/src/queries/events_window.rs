use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatEvent, EventWrapper, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub mid_point: MessageIndex,
    pub max_events: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub affected_events: Vec<EventWrapper<ChatEvent>>,
}
