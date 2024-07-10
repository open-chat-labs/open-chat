use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub credential_jwt: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success,
    Invalid(String),
    UserNotFound,
}
