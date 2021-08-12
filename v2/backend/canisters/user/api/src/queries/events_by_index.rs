use candid::CandidType;
use serde::Deserialize;
use types::events::DirectChatEvent;
use types::{EventIndex, EventWrapper, UserId};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_id: UserId,
    pub events: Vec<EventIndex>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<DirectChatEvent>>,
}
