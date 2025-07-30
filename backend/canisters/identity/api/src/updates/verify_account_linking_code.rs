use candid::{CandidType, Deserialize};
use oc_error_codes::OCError;
use serde::Serialize;
use ts_export::ts_export;

#[ts_export(identity, verify_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub code: String,
}

#[ts_export(identity, verify_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    Error(OCError),
}
