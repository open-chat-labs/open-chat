use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, CommunityId, CommunityPermissions, GroupGate, GroupRules};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<CommunityPermissions>,
    pub gate: Option<GroupGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    CyclesBalanceTooLow,
    UserNotFound,
    InternalError,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
}
