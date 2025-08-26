use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(registry, add_message_filter)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub regex: String,
}

#[ts_export(registry, add_message_filter)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    NotAuthorized,
    AlreadyAdded,
    InvalidRequest(String),
    InternalError(String),
}
