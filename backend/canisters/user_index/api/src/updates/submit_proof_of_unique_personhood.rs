use candid::{CandidType, Principal};
use ts_export::ts_export;

#[ts_export(user_index, submit_proof_of_unique_personhood)]
#[derive(CandidType, Clone, Debug)]
pub struct Args {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
}

#[ts_export(user_index, submit_proof_of_unique_personhood)]
#[derive(CandidType, Clone, Debug)]
pub enum Response {
    Success,
    Invalid(String),
    UserNotFound,
}
