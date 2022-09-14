use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, FieldTooLongResult, FieldTooShortResult, GroupPermissions, GroupRules, OptionUpdate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub avatar: OptionUpdate<Avatar>,
    pub permissions: Option<GroupPermissions>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInGroup,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    InternalError,
}
