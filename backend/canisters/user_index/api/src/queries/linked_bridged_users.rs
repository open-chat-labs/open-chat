use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BridgedUserSummary, Empty};

pub type Args = Empty;

// The accounts on other platforms which the caller has linked to themself
#[ts_export(user_index, linked_bridged_users)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<BridgedUserSummary>),
}
