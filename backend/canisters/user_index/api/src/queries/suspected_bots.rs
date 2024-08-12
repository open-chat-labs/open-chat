use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub after: Option<UserId>,
    pub count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
