use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AccessorId, SuccessOnly};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub accessor_ids: Vec<AccessorId>,
}

pub type Response = SuccessOnly;
