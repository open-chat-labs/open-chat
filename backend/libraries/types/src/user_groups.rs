use crate::UserId;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct UserGroupSummary {
    pub user_group_id: u32,
    pub name: String,
    pub members: u32,
}

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct UserGroupDetails {
    pub user_group_id: u32,
    pub name: String,
    pub members: Vec<UserId>,
}
