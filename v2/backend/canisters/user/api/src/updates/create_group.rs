use candid::CandidType;
use serde::Deserialize;
use types::GroupChatId;

pub const MAX_GROUP_NAME_LENGTH: u32 = 25;
pub const MAX_GROUP_DESCRIPTION_LENGTH: u32 = 1024;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: Option<String>,
    pub history_visible_to_new_joiners: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
    NameTaken,
    Throttled,
    InternalError,
    NotAuthorised,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub group_chat_id: GroupChatId,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct FieldTooLongResult {
    pub length_provided: u32,
    pub max_length: u32,
}
