use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, EventWrapper, Message, MessageIndex};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub messages: Vec<MessageIndex>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
}
