use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::Milliseconds;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub old_principal: Principal,
    pub new_principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessPause(Milliseconds),
    InternalError(String),
}
