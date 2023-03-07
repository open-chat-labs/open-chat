use candid::CandidType;
use chat_events::ChatEventInternal;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventWrapper, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub start_index: EventIndex,
    pub max_events: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ThreadMessageNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<ChatEventInternal>>,
    pub latest_event_index: EventIndex,
}
