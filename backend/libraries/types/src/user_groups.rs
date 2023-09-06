use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserGroupSummary {
    pub user_group_id: u32,
    pub name: String,
    pub members: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserGroupDetails {
    pub user_group_id: u32,
    pub name: String,
    pub members: Vec<UserId>,
}
