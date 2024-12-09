use candid::Principal;
use canister_state_macros::canister_state;
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use event_store_utils::EventDeduper;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use sha256::sha256;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use std::time::Duration;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
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
        let event_store_client_info = self.data.event_store_client.info();
        let event_store_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            push_events_whitelist: self.data.push_events_whitelist.iter().copied().collect(),
            event_store_client_info,
            ledger_transaction_processed_up_to: self.data.ledger_transaction_processed_up_to,
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                event_sink: event_store_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                chat_ledger: self.data.chat_ledger_canister_id,
                chat_governance: self.data.chat_governance_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub push_events_whitelist: HashSet<Principal>,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub event_deduper: EventDeduper,
    pub cycles_dispenser_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub chat_governance_canister_id: CanisterId,
    pub chat_treasury_subaccount: [u8; 32],
    pub ledger_transaction_processed_up_to: Option<u64>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        push_events_whitelist: HashSet<Principal>,
        event_store_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        chat_governance_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            push_events_whitelist,
            event_store_client: EventStoreClientBuilder::new(event_store_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            event_deduper: EventDeduper::default(),
            cycles_dispenser_canister_id,
            chat_ledger_canister_id,
            chat_governance_canister_id,
            chat_treasury_subaccount: compute_distribution_subaccount_bytes(chat_governance_canister_id, 0),
            ledger_transaction_processed_up_to: None,
            rng_seed: [0; 32],
            test_mode,
        }
    }

    pub fn chat_treasury_account(&self) -> Account {
        Account {
            owner: self.chat_governance_canister_id,
            subaccount: Some(self.chat_treasury_subaccount),
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
    pub push_events_whitelist: Vec<Principal>,
    pub event_store_client_info: EventStoreClientInfo,
    pub ledger_transaction_processed_up_to: Option<u64>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub event_sink: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub chat_ledger: CanisterId,
    pub chat_governance: CanisterId,
}

fn compute_distribution_subaccount_bytes(principal_id: Principal, nonce: u64) -> [u8; 32] {
    const DOMAIN: &[u8] = b"token-distribution";
    const DOMAIN_LENGTH: [u8; 1] = [0x12];

    let mut bytes = Vec::new();
    bytes.extend_from_slice(&DOMAIN_LENGTH);
    bytes.extend_from_slice(DOMAIN);
    bytes.extend_from_slice(principal_id.as_slice());
    bytes.extend_from_slice(&nonce.to_be_bytes());
    sha256(&bytes)
}
