use crate::{User, client};
use candid::{Nat, Principal};
use constants::{
    CHAT_LEDGER_CANISTER_ID, CHAT_SYMBOL, CHAT_TRANSFER_FEE, ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE,
};
use pocket_ic::PocketIc;
use rand::{RngExt, SeedableRng, rngs::StdRng};
use std::time::{Duration, SystemTime};
use std::{path::PathBuf, time::UNIX_EPOCH};
use types::{CanisterId, Hash, HttpRequest, HttpResponse, TimestampMillis, TimestampNanos, TokenInfo, UserId};

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

// For tests whose tokens are verified against the wall clock. A new env starts at the current
// time, but setup can leave its clock a little ahead, and PocketIC refuses to move it back.
pub fn catch_up_with_wall_clock(env: &mut PocketIc) {
    let now = SystemTime::now().into();
    if env.get_time() < now {
        env.set_time(now);
    }
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

// Ticks until the canister of a deleted group or community has been uninstalled and started again,
// from which point callers are told it has no code. It's never deleted, so that the cycles which
// can't be refunded from it may be recovered once the IC allows. Time isn't advanced, so this
// doesn't wait on anything which retries after a delay, such as the refund of its cycles.
pub fn wait_for_deleted_canister_to_be_uninstalled(env: &mut PocketIc, canister_id: CanisterId) {
    for _ in 0..50 {
        if env
            .query_call(canister_id, Principal::anonymous(), "http_request", Vec::new())
            .is_err_and(|error| error.error_code == pocket_ic::ErrorCode::CanisterWasmModuleNotFound)
        {
            assert!(env.canister_exists(canister_id));
            return;
        }
        env.tick();
    }
    panic!("Canister {canister_id} was not uninstalled");
}

pub fn set_freezing_threshold(env: &PocketIc, canister_id: CanisterId, controller: CanisterId, freezing_threshold: Nat) {
    env.update_canister_settings(
        canister_id,
        Some(controller),
        pocket_ic::CanisterSettings {
            freezing_threshold: Some(freezing_threshold),
            ..Default::default()
        },
    )
    .unwrap();
}

// The cycles above the canister's freezing threshold
pub fn liquid_cycle_balance(env: &PocketIc, canister_id: CanisterId, controller: Principal) -> u128 {
    let status = env.canister_status(canister_id, Some(controller)).unwrap();
    let to_u128 = |nat: &Nat| -> u128 { nat.0.clone().try_into().unwrap() };
    let freeze_threshold = utils::cycles::freeze_threshold_cycles(
        to_u128(&status.idle_cycles_burned_per_day),
        status.settings.freezing_threshold.0.clone().try_into().unwrap(),
        to_u128(&status.reserved_cycles),
    );
    to_u128(&status.cycles).saturating_sub(freeze_threshold)
}

pub fn wait_for_cycle_balance_above(env: &mut PocketIc, canister_id: CanisterId, balance: u128) {
    for _ in 0..50 {
        if env.cycle_balance(canister_id) > balance {
            return;
        }
        env.tick();
    }
    panic!(
        "Cycles balance of {canister_id} didn't rise above {balance}. Balance: {}",
        env.cycle_balance(canister_id)
    );
}

// Ticks until the user's canister lists their direct chat with `them`, ie. the first message sent in
// it has been delivered. This can take many rounds, since a newly created User canister periodically
// takes around 10 rounds to handle its first message (seemingly while the wasm is compiled on its
// subnet), a number which grows with the size of the wasm.
pub fn wait_for_direct_chat(env: &mut PocketIc, user: &User, them: UserId) {
    for _ in 0..30 {
        let initial_state = client::user::happy_path::initial_state(env, user);
        if initial_state.direct_chats.summaries.iter().any(|c| c.them == them) {
            return;
        }
        env.tick();
    }
    panic!("User {} did not receive the message from user {them}", user.user_id);
}

// The index the next event to reach the event store will have
pub fn next_event_store_index(env: &mut PocketIc, controller: Principal, event_store: CanisterId) -> u64 {
    client::event_store::happy_path::events(env, controller, event_store, 0, 0)
        .latest_event_index
        .map_or(0, |index| index + 1)
}

// Moves time on a minute at a time, since canisters batch the events they push before flushing them
// to the event store (some via the LocalUserIndex, which batches them again), until each of the
// events (by name and timestamp) has reached it at or after the index `since`, then returns how many
// times each has. Time moves on by at least 4 minutes, so that a duplicate has time to arrive too.
// Every event since `since` is searched, rather than only the latest, since the canisters left by the
// other tests which have drawn the env push their own events as time moves on.
pub fn wait_for_event_store_events(
    env: &mut PocketIc,
    controller: Principal,
    event_store: CanisterId,
    since: u64,
    events: &[(&str, TimestampMillis)],
) -> Vec<usize> {
    let mut counts = Vec::new();
    for minute in 1..=10 {
        env.advance_time(Duration::from_millis(60_000));
        tick_many(env, 3);
        counts = event_store_counts(env, controller, event_store, since, events);
        if minute >= 4 && counts.iter().all(|&count| count > 0) {
            break;
        }
    }
    counts
}

// How many times each of the events (by name and timestamp) is in the event store at or after the
// index `since`
fn event_store_counts(
    env: &mut PocketIc,
    controller: Principal,
    event_store: CanisterId,
    since: u64,
    events: &[(&str, TimestampMillis)],
) -> Vec<usize> {
    let mut counts = vec![0; events.len()];
    let mut start = since;
    loop {
        let page = client::event_store::happy_path::events(env, controller, event_store, start, 500).events;
        if page.is_empty() {
            return counts;
        }
        start += page.len() as u64;
        for event in page.iter() {
            for (count, (name, timestamp)) in counts.iter_mut().zip(events) {
                if event.name == *name && event.timestamp == *timestamp {
                    *count += 1;
                }
            }
        }
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
