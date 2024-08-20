use candid::CandidType;
use ts_export::ts_export;
use types::{CurrentUserSummary, TimestampMillis, UserId, UserSummaryV2};

#[ts_export(user_index, users)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
    pub users_suspended_since: Option<TimestampMillis>,
}

#[ts_export(user_index, users)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Result),
}

#[ts_export(user_index, users)]
#[derive(CandidType, Debug)]
pub struct Result {
    pub users: Vec<UserSummaryV2>,
    pub current_user: Option<CurrentUserSummary>,
    pub deleted: Vec<UserId>,
    pub timestamp: TimestampMillis,
}

#[ts_export(user_index, users)]
#[derive(CandidType, Debug)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
