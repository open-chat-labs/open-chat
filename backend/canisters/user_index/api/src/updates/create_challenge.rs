use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Challenge, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Challenge),
    Throttled,
}
