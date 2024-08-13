use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[ts_export(user_index, submit_proof_of_unique_personhood)]
pub struct Args {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[ts_export(user_index, submit_proof_of_unique_personhood)]
pub enum Response {
    Success,
    Invalid(String),
    UserNotFound,
}
