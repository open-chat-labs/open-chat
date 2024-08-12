use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/platformModerators.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/platformModerators.ts")]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
