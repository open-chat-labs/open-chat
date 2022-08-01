use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, FieldTooLongResult, FieldTooShortResult, GroupPermissions, OptionUpdate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
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
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    InternalError,
}
