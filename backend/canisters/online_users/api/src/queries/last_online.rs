use candid::CandidType;
use ts_export::ts_export;
use types::{Milliseconds, UserId};

#[ts_export(online_users, last_online)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[ts_export(online_users, last_online)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Vec<UserLastOnline>),
}

#[ts_export(online_users, last_online)]
#[derive(CandidType, Debug)]
pub struct UserLastOnline {
    pub user_id: UserId,
    pub duration_since_last_online: Milliseconds,
}
