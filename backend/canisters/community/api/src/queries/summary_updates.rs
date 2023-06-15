use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityCanisterCommunitySummaryUpdates, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

// Allow the large size difference because essentially all responses are the large variant anyway
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityCanisterCommunitySummaryUpdates),
    SuccessNoUpdates,
    PrivateCommunity,
}
