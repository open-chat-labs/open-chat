use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/reportedMessages.ts")]
pub struct Args {
    pub user_id: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/reportedMessages.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/reportedMessages.ts")]
pub struct SuccessResult {
    pub json: String,
}
