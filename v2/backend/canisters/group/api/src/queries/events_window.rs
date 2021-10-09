use candid::CandidType;
use serde::Deserialize;
use types::{GroupChatEvent, EventWrapper, MessageIndex};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub mid_point: MessageIndex,
    pub max_messages: u32,
    pub max_events: u32,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<GroupChatEvent>>,
    pub affected_events: Vec<EventWrapper<GroupChatEvent>>,
}
