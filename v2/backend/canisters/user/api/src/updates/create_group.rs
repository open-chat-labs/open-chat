use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, FieldTooLongResult};

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
    NameTaken,
    Throttled,
    InternalError,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
}
