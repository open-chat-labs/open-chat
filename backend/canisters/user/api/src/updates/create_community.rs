use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, CommunityId, CommunityPermissions, FieldTooLongResult, FieldTooShortResult, GroupGate, GroupRules};

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
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    MaxCommunitiesCreated(u32),
    NameTaken,
    Throttled,
    UserSuspended,
    Unauthorized,
    InternalError,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
}
