use candid::CandidType;
use ts_export::ts_export;
use types::UserId;

#[ts_export(user_index, unsuspend_user)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(user_index, unsuspend_user)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UserNotSuspended,
    UserNotFound,
    InternalError(String),
}
