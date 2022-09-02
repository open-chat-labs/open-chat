use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatEvent, EventIndex, EventWrapper, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub mid_point: MessageIndex,
    pub max_events: u32,
    pub invite_code: Option<u64>,
    pub latest_client_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    ThreadMessageNotFound,
    ReplicaNotUpToDate,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub affected_events: Vec<EventWrapper<ChatEvent>>,
    pub latest_event_index: EventIndex,
}
