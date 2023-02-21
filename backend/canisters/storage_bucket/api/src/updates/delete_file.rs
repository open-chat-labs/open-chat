use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::FileId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    NotFound,
}
