use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, FieldTooLongResult, FieldTooShortResult, GroupRules, OptionUpdate, OptionalGroupPermissions};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: Option<String>,
    pub description: Option<String>,
    pub rules: Option<GroupRules>,
    pub avatar: OptionUpdate<Avatar>,
    pub permissions: Option<OptionalGroupPermissions>,
    pub correlation_id: u64,
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
