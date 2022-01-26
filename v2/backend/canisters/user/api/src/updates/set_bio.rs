use candid::CandidType;
use serde::Deserialize;
use std::fmt::Debug;
use types::FieldTooLongResult;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub text: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    TooLong(FieldTooLongResult),
}
