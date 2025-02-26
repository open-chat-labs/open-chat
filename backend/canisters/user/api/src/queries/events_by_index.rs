use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

#[ts_export(user, events_by_index)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    #[ts(skip)]
    pub bot_api_key_secret: Option<String>,
    pub events: Vec<EventIndex>,
    pub latest_known_update: Option<TimestampMillis>,
}

pub use crate::EventsResponse as Response;
