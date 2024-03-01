use crate::model::salt::Salt;
use candid::Principal;
use canister_state_macros::canister_state;
use event_sink_client::{EventSinkClient, EventSinkClientBuilder, EventSinkClientInfo};
use event_sink_client_cdk_runtime::CdkRuntime;
use event_sink_utils::EventDeduper;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use sha256::sha256;
use std::cell::RefCell;
use std::collections::HashSet;
use std::time::Duration;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod jobs;
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
            ledger_transaction_processed_up_to: self.data.ledger_transaction_processed_up_to,
            canister_ids: CanisterIds {
                event_sink: event_sink_canister_id,
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
    pub events_sink_client: EventSinkClient<CdkRuntime>,
    pub event_deduper: EventDeduper,
    pub cycles_dispenser_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub chat_governance_canister_id: CanisterId,
    pub chat_treasury_subaccount: [u8; 32],
    pub ledger_transaction_processed_up_to: Option<u64>,
    pub salt: Salt,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        push_events_whitelist: HashSet<Principal>,
        events_sink_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        chat_governance_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            push_events_whitelist,
            events_sink_client: EventSinkClientBuilder::new(events_sink_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            event_deduper: EventDeduper::default(),
            cycles_dispenser_canister_id,
            chat_ledger_canister_id,
            chat_governance_canister_id,
            chat_treasury_subaccount: compute_distribution_subaccount_bytes(chat_governance_canister_id, 0),
            ledger_transaction_processed_up_to: None,
            salt: Salt::default(),
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
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub push_events_whitelist: Vec<Principal>,
    pub event_sink_client_info: EventSinkClientInfo,
    pub ledger_transaction_processed_up_to: Option<u64>,
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
