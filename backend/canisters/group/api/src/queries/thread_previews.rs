use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventWrapper, Message, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub threads: Vec<MessageIndex>,
    pub latest_client_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    ReplicaNotUpToDate(EventIndex),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
    pub latest_event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadPreview {
    pub root_message: EventWrapper<Message>,
    pub latest_replies: Vec<EventWrapper<Message>>,
    pub total_replies: u32,
}
