use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventWrapper, Message, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub messages: Vec<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
}
