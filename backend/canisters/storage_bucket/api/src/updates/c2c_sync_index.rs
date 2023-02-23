use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessorId, FileId, FileRemoved};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users_added: Vec<Principal>,
    pub users_removed: Vec<Principal>,
    pub accessors_removed: Vec<AccessorId>,
    pub user_ids_updated: Vec<(Principal, Principal)>,
    pub files_to_remove: Vec<FileId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub files_removed: Vec<FileRemoved>,
}
