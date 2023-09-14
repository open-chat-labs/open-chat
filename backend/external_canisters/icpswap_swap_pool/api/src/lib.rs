use candid::CandidType;
use serde::{Deserialize, Serialize};

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPSwapResult<T> {
    #[serde(rename = "ok")]
    Ok(T),
    #[serde(rename = "err")]
    Err(ICPSwapError),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPSwapError {
    CommonError,
    InternalError(String),
    UnsupportedToken(String),
    InsufficientFunds,
}
