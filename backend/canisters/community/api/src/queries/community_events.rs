use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityEvent, EventIndex, EventWrapper, TimestampMillis};

pub type Args = EventsPageArgs;

#[ts_export(community, community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsPageArgs {
    pub start_index: EventIndex,
    pub ascending: bool,
    pub max_events: u32,
}

#[ts_export(community, community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventsResponse),
    Error(OCError),
}

#[ts_export(community, community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsResponse {
    #[ts(as = "Vec<types::EventWrapperCommunityEvent>")]
    pub events: Vec<EventWrapper<CommunityEvent>>,
    pub unauthorized: Vec<EventIndex>,
    pub latest_event_index: EventIndex,
    pub community_last_updated: TimestampMillis,
}
