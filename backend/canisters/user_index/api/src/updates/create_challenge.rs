use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Challenge;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Challenge),
    Throttled,
}
