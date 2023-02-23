use crate::ProjectedAllowance;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, FileId, Hash};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_hash: Hash,
    pub file_size: u64,
    pub file_id_seed: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AllowanceExceeded(ProjectedAllowance),
    UserNotFound,
    BucketUnavailable,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub canister_id: CanisterId,
    pub file_id: FileId,
    pub chunk_size: u32,
    pub byte_limit: u64,
    pub bytes_used: u64,
    pub bytes_used_after_upload: u64,
    pub projected_allowance: ProjectedAllowance,
}
