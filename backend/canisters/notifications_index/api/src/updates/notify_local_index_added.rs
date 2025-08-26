use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
}

pub type Response = UnitResult;
