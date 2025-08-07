use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, SuccessOnly};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub enabled: bool,
}

pub type Response = SuccessOnly;
