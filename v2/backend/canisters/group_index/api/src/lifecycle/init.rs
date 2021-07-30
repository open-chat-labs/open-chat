use candid::CandidType;
use serde::Deserialize;
use shared::canisters::canister_wasm::CanisterWasm;
use shared::types::CanisterId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_id: CanisterId,
}
