use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
    pub local_group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    InternalError(String),
    Error(OCError),
}
