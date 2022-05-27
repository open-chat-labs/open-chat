use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{DirectChatEvent, EventIndex, EventWrapper, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub start_index: EventIndex,
    pub ascending: bool,
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
