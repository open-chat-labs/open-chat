use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventsResponse, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub events: Vec<EventIndex>,
    pub latest_client_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventsResponse),
    ChatNotFound,
    ReplicaNotUpToDate(EventIndex),
}
