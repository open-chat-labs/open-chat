use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub enabled: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
