use crate::community_events::{self, EventsPageArgs};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInitiator, EventIndex, UserId};

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
pub struct EventsByIndexArgs {
    pub events: Vec<EventIndex>,
}

pub type Response = community_events::Response;
