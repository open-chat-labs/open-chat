use canister_state_macros::canister_state;
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use model::bot_registry::BotRegistry;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::time::Duration;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped, UserId};
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

    pub fn is_caller_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_index_canister_id == caller
    }

    pub fn metrics(&self) -> Metrics {
        let event_store_client_info = self.data.event_store_client.info();
        let event_store_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            event_store_client_info,
            canister_ids: CanisterIds {
                local_user_index: self.data.local_user_index_canister_id,
                local_group_index: self.data.local_group_index_canister_id,
                event_relay: event_store_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
            bots: self
                .data
                .bots
                .iter()
                .map(|b| BotMetrics {
                    user_id: b.user_id,
                    name: b.name.clone(),
                    commands: b.commands.iter().map(|c| c.name.clone()).collect(),
                })
                .collect(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub local_group_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    #[serde(default)]
    pub bots: BotRegistry,
    pub rng_seed: [u8; 32],
    pub public_key: String,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        local_group_index_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        public_key: String,
        test_mode: bool,
    ) -> Data {
        Data {
            user_index_canister_id,
            local_user_index_canister_id,
            local_group_index_canister_id,
            cycles_dispenser_canister_id,
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            rng_seed: [0; 32],
            public_key,
            test_mode,
            bots: BotRegistry::default(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub event_store_client_info: EventStoreClientInfo,
    pub canister_ids: CanisterIds,
    pub bots: Vec<BotMetrics>,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub event_relay: CanisterId,
    pub cycles_dispenser: CanisterId,
}

#[derive(Serialize, Debug)]
pub struct BotMetrics {
    pub user_id: UserId,
    pub name: String,
    pub commands: Vec<String>,
}
