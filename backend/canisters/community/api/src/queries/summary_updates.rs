use ic_principal::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityCanisterCommunitySummaryUpdates, TimestampMillis};

#[ts_export(community, summary_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    #[ts(skip)]
    pub on_behalf_of: Option<Principal>,
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

// Allow the large size difference because essentially all responses are the large variant anyway
#[ts_export(community, summary_updates)]
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityCanisterCommunitySummaryUpdates),
    SuccessNoUpdates,
    Error(OCError),
}
