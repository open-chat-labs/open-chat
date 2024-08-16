use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct FieldTooShortResult {
    pub length_provided: u32,
    pub min_length: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct FieldTooLongResult {
    pub length_provided: u32,
    pub max_length: u32,
}
