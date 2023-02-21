use crate::ProjectedAllowance;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Hash;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_hash: Hash,
    pub file_size: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ProjectedAllowance),
    AllowanceExceeded(ProjectedAllowance),
    UserNotFound,
}
