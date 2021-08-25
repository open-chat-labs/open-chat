use candid::CandidType;
use serde::Deserialize;
use types::{DirectChatEvent, EventIndex, EventWrapper, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub from_index: EventIndex,
    pub to_index: EventIndex,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<DirectChatEvent>>,
}
