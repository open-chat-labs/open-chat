use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessorId, FileId, FileRemoved, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub users_added: Vec<Principal>,
    pub users_removed: Vec<Principal>,
    pub accessors_removed: Vec<AccessorId>,
    pub files_to_remove: Vec<FileId>,
    // Users migrated to a MultiUser canister, each as (old id, new id). Optional so that a bucket
    // can decode the args of a StorageIndex released before it.
    pub user_ids_migrated: Option<Vec<(UserId, UserId)>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub files_removed: Vec<FileRemoved>,
}
