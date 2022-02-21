use candid::CandidType;
use serde::Deserialize;
use types::{Avatar, FieldTooLongResult, OptionUpdate};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar: OptionUpdate<Avatar>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInGroup,
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    InternalError,
}
