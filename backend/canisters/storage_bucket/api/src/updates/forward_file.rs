use candid::CandidType;
use serde::Deserialize;
use types::{AccessorId, FileId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
    pub accessors: Vec<AccessorId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(FileId),
    NotAuthorized,
    NotFound,
}
