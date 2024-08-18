use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[ts_export(group_index, set_group_upgrade_concurrency)]
pub struct Args {
    pub value: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, set_group_upgrade_concurrency)]
pub enum Response {
    Success,
    NotAuthorized,
    InternalError(String),
}
