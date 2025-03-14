use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityCanisterCommunitySummaryUpdates, TimestampMillis};

#[ts_export(community, summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[ts(skip)]
    pub on_behalf_of: Option<Principal>,
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

// Allow the large size difference because essentially all responses are the large variant anyway
#[ts_export(community, summary_updates)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityCanisterCommunitySummaryUpdates),
    SuccessNoUpdates,
    PrivateCommunity,
    Error(u16, Option<String>),
}
