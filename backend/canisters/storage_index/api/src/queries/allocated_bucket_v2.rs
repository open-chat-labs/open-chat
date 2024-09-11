use crate::ProjectedAllowance;
use candid::CandidType;
use ts_export::ts_export;
use types::{CanisterId, FileId, Hash};

#[ts_export(storage_index, allocation_bucket)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub file_hash: Hash,
    pub file_size: u64,
    pub file_id_seed: Option<u128>,
}

#[ts_export(storage_index, allocation_bucket)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    AllowanceExceeded(ProjectedAllowance),
    UserNotFound,
    BucketUnavailable,
}

#[ts_export(storage_index, allocation_bucket)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub canister_id: CanisterId,
    pub file_id: FileId,
    pub chunk_size: u32,
    pub byte_limit: u64,
    pub bytes_used: u64,
    pub bytes_used_after_upload: u64,
    pub projected_allowance: ProjectedAllowance,
}
