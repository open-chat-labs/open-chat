use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventWrapper, Message, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub messages: Vec<MessageIndex>,
    pub latest_client_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    ThreadMessageNotFound,
    ReplicaNotUpToDate(EventIndex),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
}
