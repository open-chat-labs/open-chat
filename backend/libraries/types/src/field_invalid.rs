use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FieldTooShortResult {
    pub length_provided: u32,
    pub min_length: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FieldTooLongResult {
    pub length_provided: u32,
    pub max_length: u32,
}
