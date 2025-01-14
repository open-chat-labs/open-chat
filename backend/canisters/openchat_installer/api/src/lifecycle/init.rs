use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_principals: Vec<Principal>,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub airdrop_bot_canister_id: CanisterId,
    pub online_users_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub storage_index_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub event_relay_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub translations_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub nns_governance_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
