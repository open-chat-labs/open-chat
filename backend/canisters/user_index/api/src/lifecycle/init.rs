use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{CanisterId, CanisterWasm, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call upgrade_user_canister_wasm
    pub service_principals: Vec<Principal>,

    // Only these principals can call pending_sms_messages
    pub sms_service_principals: Vec<Principal>,

    // The wasm module for creating user canisters
    pub user_canister_wasm: CanisterWasm,

    pub group_index_canister_id: CanisterId,

    pub notifications_canister_ids: Vec<CanisterId>,

    pub online_users_aggregator_canister_id: CanisterId,

    pub callback_canister_id: CanisterId,

    pub open_storage_index_canister_id: CanisterId,

    pub transaction_notifier_canister_id: CanisterId,

    pub ledger_canister_id: CanisterId,

    pub wasm_version: Version,

    // Accepts confirmation code 123456
    pub test_mode: bool,
}
