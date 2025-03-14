use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::PublicGroupSummary;

#[ts_export(group, public_summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

#[ts_export(group, public_summary)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    Error(u16, Option<String>),
}

#[ts_export(group, public_summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: PublicGroupSummary,
    pub is_invited: bool,
}
