use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::FieldTooLongResult;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub text: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TooLong(FieldTooLongResult),
    UserSuspended,
}
