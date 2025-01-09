use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub jokes: HashMap<u32, String>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum Response {
    Success(u32),
    NotAuthorized,
}
