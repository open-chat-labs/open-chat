use crate::client;
use candid::Principal;
use constants::{
    CHAT_LEDGER_CANISTER_ID, CHAT_SYMBOL, CHAT_TRANSFER_FEE, ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE,
};
use pocket_ic::PocketIc;
use rand::{RngExt, SeedableRng, rngs::StdRng};
use std::time::{Duration, SystemTime};
use std::{path::PathBuf, time::UNIX_EPOCH};
use types::{CanisterId, Hash, HttpRequest, HttpResponse, TimestampMillis, TimestampNanos, TokenInfo};

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

// The canister's metrics, or None if it can't currently be queried, eg. while it is stopped for an upgrade
pub fn try_metrics(env: &PocketIc, canister_id: CanisterId) -> Option<serde_json::Value> {
    let args = HttpRequest {
        method: "GET".to_string(),
        url: "/metrics".to_string(),
        headers: Vec::new(),
        body: Vec::new(),
    };
    let bytes = env
        .query_call(
            canister_id,
            Principal::anonymous(),
            "http_request",
            candid::encode_one(args).ok()?,
        )
        .ok()?;
    let response: HttpResponse = candid::decode_one(&bytes).ok()?;
    serde_json::from_slice(&response.body).ok()
}

// Waits for the canister of a deleted group or community to be deleted, which its LocalUserIndex
// does once it has uninstalled the canister and refunded its cycles. The refund can be held up by
// the IC's install_code rate limit if the canister was installed only moments ago, in which case
// the LocalUserIndex retries after a delay, so time is advanced if it takes more than a few rounds.
// A test which gets that far should discard its environment.
pub fn wait_for_canister_to_be_deleted(env: &mut PocketIc, canister_id: CanisterId) {
    for i in 0..220 {
        if !env.canister_exists(canister_id) {
            return;
        }
        if i < 20 {
            env.tick();
        } else {
            env.advance_time(Duration::from_secs(60));
            tick_many(env, 5);
        }
    }
    panic!("Canister {canister_id} was not deleted");
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

// Checks that a wasm committed alongside its wat was built from it with `wat2wasm`. The `wat`
// crate's output is identical but for a "name" custom section which it appends, so what follows
// the committed wasm must be exactly that section.
pub fn assert_wasm_built_from_wat(wasm: &[u8], wat: &str, file_name: &str) {
    let from_wat = wat::parse_str(wat).unwrap();
    let is_name_section = |section: &[u8]| {
        let Some((&id, rest)) = section.split_first() else {
            return false;
        };
        let (size, content) = read_leb128(rest);
        id == 0 && content.len() == size && content.starts_with(b"\x04name")
    };

    assert!(
        from_wat.strip_prefix(wasm).is_some_and(is_name_section),
        "{file_name} is out of date, rebuild it from the wat"
    );
}

fn read_leb128(bytes: &[u8]) -> (usize, &[u8]) {
    let mut value = 0;
    for (i, byte) in bytes.iter().enumerate().take(5) {
        value |= usize::from(byte & 0x7f) << (7 * i);
        if byte & 0x80 == 0 {
            return (value, &bytes[i + 1..]);
        }
    }
    (usize::MAX, &[])
}
