use crate::ProjectedAllowance;
use candid::CandidType;
use ts_export::ts_export;
use types::Hash;

#[ts_export(storage_index, can_forward)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub file_hash: Hash,
    pub file_size: u64,
}

#[ts_export(storage_index, can_forward)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(ProjectedAllowance),
    AllowanceExceeded(ProjectedAllowance),
    UserNotFound,
}
