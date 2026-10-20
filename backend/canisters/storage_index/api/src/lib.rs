use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessorId, FileAdded, FileRemoved};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
use ts_export::ts_export;
pub use updates::*;

#[ts_export(storage_index)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ProjectedAllowance {
    pub byte_limit: u64,
    pub bytes_used: u64,
    pub bytes_used_after_upload: u64,
    pub bytes_used_after_operation: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    AddOrUpdateUser(add_or_update_users::UserConfig),
    RemoveUser(Principal),
    VaultOp(c2c_vault_ops::VaultOp),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    RemoveAccessor(AccessorId),
}

// What a bucket tells the StorageIndex, at `c2c_storage_bucket`. New variants go at the end: an
// older StorageIndex then fails to decode the batch, and the bucket retries it, rather than
// misreading a variant as another.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum StorageBucketEvent {
    FileAdded(FileAdded),
    FileRemoved(FileRemoved),
    CsamMatch(c2c_sync_bucket::CsamMatch),
    CsamHashDenylisted(c2c_sync_bucket::CsamHashDenylisted),
}
