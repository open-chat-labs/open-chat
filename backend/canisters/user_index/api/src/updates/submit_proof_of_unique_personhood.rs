use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, submit_proof_of_unique_personhood)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
}

#[ts_export(user_index, submit_proof_of_unique_personhood)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success,
    Invalid(String),
    UserNotFound,
    Error(OCError),
}
