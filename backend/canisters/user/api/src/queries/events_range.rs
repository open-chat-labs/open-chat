use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatEvent, EventIndex, EventWrapper, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub from_index: EventIndex,
    pub to_index: EventIndex,
    pub latest_client_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    ReplicaNotUpToDate,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub affected_events: Vec<EventWrapper<ChatEvent>>,
    pub latest_event_index: EventIndex,
}
