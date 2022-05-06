use candid::CandidType;
use serde::Deserialize;
use types::PublicGroupSummary;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: PublicGroupSummary,
}
