use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct UserGroupSummary {
    pub user_group_id: u32,
    pub name: String,
    pub members: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct UserGroupDetails {
    pub user_group_id: u32,
    pub name: String,
    pub members: Vec<UserId>,
}
