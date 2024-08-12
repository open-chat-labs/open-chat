use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{Milliseconds, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/suspendUser.ts")]
pub struct Args {
    pub user_id: UserId,
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/suspendUser.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
    UserAlreadySuspended,
    UserNotFound,
    InternalError(String),
}
