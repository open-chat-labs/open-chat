use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub amount: u128,
    pub zero_for_one: bool,
}

pub type Response = Result<u128, String>;
