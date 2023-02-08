use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub enum Response {
    Success,
    NotInitialized,
    NoGroupsJoined,
    EndDateInPast,
}
