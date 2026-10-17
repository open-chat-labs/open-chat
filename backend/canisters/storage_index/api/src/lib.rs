use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::AccessorId;

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
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    RemoveAccessor(AccessorId),
}
