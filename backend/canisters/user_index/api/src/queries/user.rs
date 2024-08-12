use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{UserId, UserSummary};

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub user_id: Option<UserId>,
    pub username: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(UserSummary),
    UserNotFound,
}
