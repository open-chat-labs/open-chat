use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInitiator, CommunityEvent, EventIndex, EventWrapper, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub selection_criteria: EventsSelectionCriteria,
}

#[ts_export(community, community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsSelectionCriteria {
    Page(EventsPageArgs),
    ByIndex(EventsByIndexArgs),
}

#[ts_export(community, community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsPageArgs {
    pub start_index: EventIndex,
    pub ascending: bool,
    pub max_events: u32,
}

#[ts_export(community, community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsByIndexArgs {
    pub events: Vec<EventIndex>,
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
    pub latest_event_index: EventIndex,
    pub community_last_updated: TimestampMillis,
}
