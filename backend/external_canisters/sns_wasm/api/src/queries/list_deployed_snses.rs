use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize)]
pub struct Response {
    pub instances: Vec<DeployedSns>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct DeployedSns {
    pub root_canister_id: Option<CanisterId>,
    pub governance_canister_id: Option<CanisterId>,
    pub ledger_canister_id: Option<CanisterId>,
    pub swap_canister_id: Option<CanisterId>,
    pub index_canister_id: Option<CanisterId>,
}
