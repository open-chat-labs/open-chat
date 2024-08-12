use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success,
    NotAuthorized,
    UserNotFound,
}
