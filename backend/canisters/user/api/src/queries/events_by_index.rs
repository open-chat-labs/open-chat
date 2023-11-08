use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub events: Vec<EventIndex>,
    pub latest_known_update: Option<TimestampMillis>,
    pub latest_client_event_index: Option<EventIndex>,
}

pub use crate::EventsResponse as Response;
