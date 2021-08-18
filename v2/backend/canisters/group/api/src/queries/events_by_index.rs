use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, EventWrapper, GroupChatEvent};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<EventIndex>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<GroupChatEvent>>,
    pub latest_event_index: EventIndex,
}
