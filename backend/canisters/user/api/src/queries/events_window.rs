use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{DirectChatEvent, EventWrapper, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
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
    pub events: Vec<EventWrapper<DirectChatEvent>>,
    pub affected_events: Vec<EventWrapper<DirectChatEvent>>,
}
