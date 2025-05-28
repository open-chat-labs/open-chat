use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(group_index, mark_local_index_full)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
    pub full: bool,
}

#[ts_export(group_index, mark_local_index_full)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    LocalIndexNotFound,
    NotAuthorized,
    InternalError(String),
}
