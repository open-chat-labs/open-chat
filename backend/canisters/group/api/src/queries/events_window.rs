use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, TimestampMillis};

#[ts_export(group, events_window)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub mid_point: MessageIndex,
    pub max_messages: u32,
    pub max_events: u32,
    pub latest_known_update: Option<TimestampMillis>,
}

pub use crate::EventsResponse as Response;
