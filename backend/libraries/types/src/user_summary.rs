use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummary {
    pub user_id: UserId,
    pub username: String,
    pub seconds_since_last_online: u32,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialUserSummary {
    pub user_id: UserId,
    pub username: Option<String>,
    pub seconds_since_last_online: u32,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
}
