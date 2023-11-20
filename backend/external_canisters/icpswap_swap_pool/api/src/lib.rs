use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ResultLowercase;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

pub type ICPSwapResult<T> = ResultLowercase<T, ICPSwapError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPSwapError {
    CommonError,
    InternalError(String),
    UnsupportedToken(String),
    InsufficientFunds,
}
