use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::FieldTooLongResult;

#[ts_export(user, set_bio)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub text: String,
}

#[ts_export(user, set_bio)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TooLong(FieldTooLongResult),
    UserSuspended,
    Error(u16, Option<String>),
}
