use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/unsuspendUser/")]
pub struct Args {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/unsuspendUser/")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
    UserNotSuspended,
    UserNotFound,
    InternalError(String),
}
