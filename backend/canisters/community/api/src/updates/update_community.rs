use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FieldTooLongResult, FieldTooShortResult, GroupRules, OptionUpdate, Avatar, GroupGate, OptionalCommunityPermissions};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<GroupRules>,
    pub avatar: OptionUpdate<Avatar>,
    pub permissions: Option<OptionalCommunityPermissions>,
    pub gate: OptionUpdate<GroupGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInCommunity,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    InternalError,
    RulesTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    UserSuspended,
    CommunityFrozen,
}