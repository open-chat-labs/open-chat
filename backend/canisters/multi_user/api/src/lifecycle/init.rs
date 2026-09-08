use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}
