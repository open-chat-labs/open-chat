use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{CurrentUserSummary, TimestampMillis, UserId, UserSummaryV2};

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
    pub users_suspended_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Result {
    pub users: Vec<UserSummaryV2>,
    pub current_user: Option<CurrentUserSummary>,
    pub deleted: Vec<UserId>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
