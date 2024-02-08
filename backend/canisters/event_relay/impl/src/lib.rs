use candid::Principal;
use canister_state_macros::canister_state;
use event_sink_client::{EventSinkClient, EventSinkClientBuilder, EventSinkClientInfo};
use event_sink_client_cdk_runtime::CdkRuntime;
use event_sink_utils::EventDeduper;
use serde::{Deserialize, Serialize};
use sha256::sha256_string;
use std::cell::RefCell;
use std::collections::HashSet;
use std::time::Duration;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn can_caller_push_events(&self) -> bool {
        let caller = self.env.caller();
        self.data.push_events_whitelist.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        let event_sink_client_info = self.data.events_sink_client.info();
        let event_sink_canister_id = event_sink_client_info.event_sink_canister_id;

        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            push_events_whitelist: self.data.push_events_whitelist.iter().copied().collect(),
            event_sink_client_info,
            canister_ids: CanisterIds {
                event_sink: event_sink_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub push_events_whitelist: HashSet<Principal>,
    pub events_sink_client: EventSinkClient<CdkRuntime>,
    pub event_deduper: EventDeduper,
    pub cycles_dispenser_canister_id: CanisterId,
    pub salt: [u8; 32],
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        push_events_whitelist: HashSet<Principal>,
        events_sink_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            push_events_whitelist,
            events_sink_client: EventSinkClientBuilder::new(events_sink_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            event_deduper: EventDeduper::default(),
            cycles_dispenser_canister_id,
            salt: [0; 32],
            rng_seed: [0; 32],
            test_mode,
        }
    }

    pub fn obfuscate_user(&self, user: String) -> String {
        // We only want to obfuscate userId principals, so if the string is not a principal we return it as is
        if Principal::from_text(&user).is_err() {
            return user;
        }

        // Generates a 32 character string from the input value + the salt
        let mut bytes = Vec::new();
        bytes.extend_from_slice(user.as_bytes());
        bytes.extend_from_slice(&self.salt);
        sha256_string(&bytes).split_off(32)
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub push_events_whitelist: Vec<Principal>,
    pub event_sink_client_info: EventSinkClientInfo,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub event_sink: CanisterId,
    pub cycles_dispenser: CanisterId,
}
