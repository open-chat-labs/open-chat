use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Principals permitted to commit model weights and tune thresholds (the
    // SNS governance canister in production, the deployer locally)
    pub governance_principals: Vec<Principal>,
    // Principals additionally permitted to upload (inert) model chunks - the
    // dev team in production, mirroring openchat_installer's
    // upload_wasm_chunks_whitelist. Chunks only activate via a hash-pinned
    // commit_model proposal, so this grants no control over the live models.
    pub upload_model_chunks_whitelist: Vec<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
