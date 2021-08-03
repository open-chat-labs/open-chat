use crate::common::events::EventData;
use candid::CandidType;
use serde::Deserialize;
use shared::types::{EventIndex, EventWrapper, UserId};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_id: UserId,
    pub from_index: EventIndex,
    pub to_index: EventIndex,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<EventData>>,
}
