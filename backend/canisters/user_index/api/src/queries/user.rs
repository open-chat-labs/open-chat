use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{UserId, UserSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, user)]
pub struct Args {
    pub user_id: Option<UserId>,
    pub username: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, user)]
pub enum Response {
    Success(UserSummary),
    UserNotFound,
}
