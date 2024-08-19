use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, unsuspend_user)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, unsuspend_user)]
pub enum Response {
    Success,
    UserNotSuspended,
    UserNotFound,
    InternalError(String),
}
