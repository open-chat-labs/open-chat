use candid::CandidType;
use serde::Deserialize;
use types::ChatId;

pub const MAX_GROUP_NAME_LENGTH: u32 = 25;
pub const MAX_GROUP_DESCRIPTION_LENGTH: u32 = 1024;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub history_visible_to_new_joiners: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
    PublicGroupAlreadyExists,
    Throttled,
    InternalError,
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct FieldTooLongResult {
    pub length_provided: u32,
    pub max_length: u32,
}
