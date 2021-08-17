use crate::UserId;
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct UserSummary {
    pub user_id: UserId,
    pub username: String,
    pub seconds_since_last_online: u32,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PartialUserSummary {
    pub user_id: UserId,
    pub username: Option<String>,
    pub seconds_since_last_online: u32,
}
