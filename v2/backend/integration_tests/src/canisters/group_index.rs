use crate::types::{CanisterId, CanisterWasm};
use candid::CandidType;
use serde::Deserialize;

pub mod init {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub group_canister_wasm: CanisterWasm,
        pub notifications_canister_id: CanisterId,
    }
}
