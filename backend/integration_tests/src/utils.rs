use crate::client;
use candid::Principal;
use constants::{
    CHAT_LEDGER_CANISTER_ID, CHAT_SYMBOL, CHAT_TRANSFER_FEE, ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE,
};
use pocket_ic::PocketIc;
use rand::{RngExt, SeedableRng, rngs::StdRng};
use std::time::SystemTime;
use std::{path::PathBuf, time::UNIX_EPOCH};
use types::{CanisterId, Hash, HttpRequest, TimestampMillis, TimestampNanos, TokenInfo};

pub fn principal_to_username(principal: Principal) -> String {
    principal.to_string()[0..5].to_string()
}

pub fn tick_many(env: &mut PocketIc, count: usize) {
    for _ in 0..count {
        env.tick();
    }
}

pub fn now_millis(env: &PocketIc) -> TimestampMillis {
    now_nanos(env) / 1_000_000
}

pub fn now_nanos(env: &PocketIc) -> TimestampNanos {
    env.get_time().as_nanos_since_unix_epoch()
}

pub fn local_bin() -> PathBuf {
    let mut file_path =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("Failed to read CARGO_MANIFEST_DIR env variable"));
    file_path.push("wasms");
    file_path
}

pub fn generate_seed() -> Hash {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
    StdRng::seed_from_u64(now).random()
}

pub fn chat_token_info() -> TokenInfo {
    TokenInfo {
        symbol: CHAT_SYMBOL.to_string(),
        ledger: CHAT_LEDGER_CANISTER_ID,
        decimals: 8,
        fee: CHAT_TRANSFER_FEE,
    }
}

pub fn icp_token_info() -> TokenInfo {
    TokenInfo {
        symbol: ICP_SYMBOL.to_string(),
        ledger: ICP_LEDGER_CANISTER_ID,
        decimals: 8,
        fee: ICP_TRANSFER_FEE,
    }
}

pub fn metrics(env: &PocketIc, canister_id: CanisterId) -> serde_json::Value {
    let response = client::http_request(
        env,
        Principal::anonymous(),
        canister_id,
        &HttpRequest {
            method: "GET".to_string(),
            url: "/metrics".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    assert_eq!(response.status_code, 200);

    serde_json::from_slice(&response.body).unwrap()
}
