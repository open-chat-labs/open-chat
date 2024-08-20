use candid::CandidType;
use ts_export::ts_export;
use types::{UserId, UserSummary};

#[ts_export(user_index, user)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: Option<UserId>,
    pub username: Option<String>,
}

#[ts_export(user_index, user)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(UserSummary),
    UserNotFound,
}
