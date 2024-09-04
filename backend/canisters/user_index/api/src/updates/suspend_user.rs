use candid::CandidType;
use ts_export::ts_export;
use types::{Milliseconds, UserId};

#[ts_export(user_index, suspend_user)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[ts_export(user_index, suspend_user)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UserAlreadySuspended,
    UserNotFound,
    InternalError(String),
}
