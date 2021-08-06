use crate::common::events::GroupChatEvent;
use candid::CandidType;
use serde::Deserialize;
use shared::types::{EventIndex, EventWrapper};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub events: Vec<EventIndex>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<GroupChatEvent>>,
    pub latest_event_index: EventIndex,
}
