use crate::common::events::EventData;
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
    pub events: Vec<EventWrapper<EventData>>,
}
