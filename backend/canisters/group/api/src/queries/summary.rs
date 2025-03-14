use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::GroupCanisterGroupChatSummary;

#[ts_export(group, summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[ts(skip)]
    pub on_behalf_of: Option<Principal>,
}

// Allow the large size difference because essentially all responses are the large variant anyway
#[ts_export(group, summary)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    Error(OCError),
}

#[ts_export(group, summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: GroupCanisterGroupChatSummary,
}
