use candid::CandidType;
use serde::Deserialize;
use types::{FieldTooLongResult, FieldTooShortResult};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NameTaken,
    ChatNotFound,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
}
