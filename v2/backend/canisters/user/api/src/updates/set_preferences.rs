use candid::CandidType;
use serde::Deserialize;
use types::OptionalUserPreferences;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub preferences: OptionalUserPreferences,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
