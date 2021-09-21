use candid::CandidType;
use serde::Deserialize;
use types::{Avatar, FieldTooLongResult};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar: Option<Avatar>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
    NameTaken,
    InternalError,
}
