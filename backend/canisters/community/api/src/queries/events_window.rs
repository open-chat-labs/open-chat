use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, TimestampMillis};

#[ts_export(community, events_window)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub mid_point: MessageIndex,
    pub max_messages: u32,
    pub max_events: u32,
    pub latest_known_update: Option<TimestampMillis>,
}

pub use crate::EventsResponse as Response;
