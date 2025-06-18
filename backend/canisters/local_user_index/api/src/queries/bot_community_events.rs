use candid::{CandidType, Deserialize};
use community_canister::c2c_bot_community_events::EventsSelectionCriteria;
use serde::Serialize;
use ts_export::ts_export;
use types::CommunityId;

#[ts_export(local_user_index, bot_community_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub events: EventsSelectionCriteria,
}

pub type Response = community_canister::c2c_bot_community_events::Response;
