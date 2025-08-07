use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub up_to_index: u64,
}

pub type Response = SuccessOnly;
