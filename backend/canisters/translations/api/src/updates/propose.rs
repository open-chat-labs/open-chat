use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub locale: String,
    pub key: String,
    pub value: String,
}

impl Args {
    pub fn trimmed(&self) -> Args {
        Args {
            locale: self.locale.trim().to_string(),
            key: self.key.trim().to_string(),
            value: self.value.trim().to_string(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    AlreadyProposed,
    UserNotFound,
    InvalidArgs(String),
    InternalError(String),
}
