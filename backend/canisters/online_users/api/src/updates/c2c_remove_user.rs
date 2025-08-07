use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

pub type Response = SuccessOnly;
