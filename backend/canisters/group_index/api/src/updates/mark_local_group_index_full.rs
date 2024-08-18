use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, mark_local_group_index_full)]
pub struct Args {
    pub canister_id: CanisterId,
    pub full: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, mark_local_group_index_full)]
pub enum Response {
    Success,
    LocalGroupIndexNotFound,
    NotAuthorized,
    InternalError(String),
}
