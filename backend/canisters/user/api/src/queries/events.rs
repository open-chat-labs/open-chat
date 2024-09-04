use candid::CandidType;
use ts_export::ts_export;
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

#[ts_export(user, events)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub start_index: EventIndex,
    pub ascending: bool,
    pub max_messages: u32,
    pub max_events: u32,
    pub latest_known_update: Option<TimestampMillis>,
}

pub use crate::EventsResponse as Response;
