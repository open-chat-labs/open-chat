use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventsResponse, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub start_index: EventIndex,
    pub ascending: bool,
    pub max_messages: u32,
    pub max_events: u32,
    pub invite_code: Option<u64>,
    pub latest_client_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventsResponse),
    CallerNotInGroup,
    ThreadMessageNotFound,
    ReplicaNotUpToDate(EventIndex),
}
