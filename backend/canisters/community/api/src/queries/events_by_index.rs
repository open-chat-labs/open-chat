use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, EventIndex, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub events: Vec<EventIndex>,
    pub latest_client_event_index: Option<EventIndex>,
}

pub use crate::EventsResponse as Response;
