use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(user_index, unsuspend_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(user_index, unsuspend_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotSuspended,
    UserNotFound,
    InternalError(String),
    Error(u16, Option<String>),
}
