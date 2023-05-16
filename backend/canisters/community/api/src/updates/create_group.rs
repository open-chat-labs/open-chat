use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    Avatar, ChatId, CommunityGroupId, FieldTooLongResult, FieldTooShortResult, GroupGate, GroupPermissions, GroupRules,
    GroupSubtype, Milliseconds,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<GroupGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    MaxGroupsCreated(u32),
    NameTaken,
    UserSuspended,
    NotAuthorized,
    InternalError,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub group_id: CommunityGroupId,
}
