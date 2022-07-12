use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatEvent, EventWrapper, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub threads: Vec<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadPreview {
    pub root_message: EventWrapper<ChatEvent>,
    pub latest_replies: Vec<EventWrapper<ChatEvent>>,
    pub total_replies: u32,
}
