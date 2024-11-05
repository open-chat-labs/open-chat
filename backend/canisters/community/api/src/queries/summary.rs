use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CommunityCanisterCommunitySummary;

#[ts_export(community, summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[ts(skip)]
    pub on_behalf_of: Option<Principal>,
    pub invite_code: Option<u64>,
}

#[ts_export(community, summary)]
// Allow the large size difference because essentially all responses are the large variant anyway
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityCanisterCommunitySummary),
    PrivateCommunity,
}
