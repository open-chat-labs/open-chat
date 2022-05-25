use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::OptionalUserPreferences;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub preferences: OptionalUserPreferences,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
