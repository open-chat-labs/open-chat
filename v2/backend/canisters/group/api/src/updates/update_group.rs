use candid::CandidType;
use serde::Deserialize;
use types::FieldTooLongResult;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    Unchanged,
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
    NameTaken,
    InternalError,
}
