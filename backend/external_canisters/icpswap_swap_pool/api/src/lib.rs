use candid::CandidType;
use serde::{Deserialize, Serialize};

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ICPSwapResult<T> {
    Ok(T),
    Err(ICPSwapError),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPSwapError {
    CommonError,
    InternalError(String),
    UnsupportedToken(String),
    InsufficientFunds,
}
