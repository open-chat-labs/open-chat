use candid::CandidType;
use serde::Deserialize;
use types::{DirectChatEvent, EventWrapper, UserId, MessageIndex};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub mid_point: MessageIndex,
    pub max_messages: u32,
    pub max_events: u32,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<DirectChatEvent>>,
    pub affected_events: Vec<EventWrapper<DirectChatEvent>>,
}
