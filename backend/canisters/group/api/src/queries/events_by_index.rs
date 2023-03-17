use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventsResponse, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub events: Vec<EventIndex>,
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
