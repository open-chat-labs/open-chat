use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/suspectedBots.ts")]
pub struct Args {
    pub after: Option<UserId>,
    pub count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/suspectedBots.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/suspectedBots.ts")]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
