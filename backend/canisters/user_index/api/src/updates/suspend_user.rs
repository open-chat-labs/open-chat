use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{Milliseconds, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, suspend_user)]
pub struct Args {
    pub user_id: UserId,
    #[ts(optional)]
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, suspend_user)]
pub enum Response {
    Success,
    UserAlreadySuspended,
    UserNotFound,
    InternalError(String),
}
