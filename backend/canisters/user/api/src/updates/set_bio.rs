use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;

#[ts_export(user, set_bio)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub text: String,
}

#[ts_export(user, set_bio)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
