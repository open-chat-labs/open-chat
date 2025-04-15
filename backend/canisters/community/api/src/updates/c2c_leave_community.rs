use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::EmptySuccessOrError;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

pub type Response = EmptySuccessOrError;
