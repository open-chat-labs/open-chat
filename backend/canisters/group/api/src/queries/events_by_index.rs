use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, EventWrapper, GroupChatEvent};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<EventIndex>,
    pub invite_code: Option<u64>,
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
    pub latest_event_index: EventIndex,
}
