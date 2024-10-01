use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(registry, remove_message_filter)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: u64,
}

#[ts_export(registry, remove_message_filter)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    NotFound,
    InternalError(String),
}
