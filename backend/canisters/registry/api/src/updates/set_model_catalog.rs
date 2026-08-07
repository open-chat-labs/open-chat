use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ModelCatalog;

// Owner (platform-operator) sets the on-device model catalog. Not `#[ts_export]`ed: the frontend keeps
// its hand-written ModelCatalog domain type and maps the response, so the on-device types are untouched.
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub catalog: ModelCatalog,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    InvalidCatalog(String),
    InternalError(String),
}
