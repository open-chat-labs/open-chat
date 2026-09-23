use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub enabled: bool,
}

pub type Response = UnitResult;
