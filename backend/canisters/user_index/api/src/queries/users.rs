use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{CurrentUserSummary, TimestampMillis, UserId, UserSummaryV2};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
    #[ts(optional)]
    pub users_suspended_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users)]
pub struct Result {
    pub users: Vec<UserSummaryV2>,
    #[ts(optional)]
    pub current_user: Option<CurrentUserSummary>,
    pub deleted: Vec<UserId>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
