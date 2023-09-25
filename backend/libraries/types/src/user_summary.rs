use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSummary {
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_member: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialUserSummary {
    pub user_id: UserId,
    pub username: Option<String>,
    pub avatar_id: Option<u128>,
    pub is_bot: bool,
    pub suspended: bool,
    pub diamond_member: bool,
}
