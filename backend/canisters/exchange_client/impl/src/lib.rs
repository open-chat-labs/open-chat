use crate::exchanges::icdex::ICDexClient;
use crate::exchanges::Exchange;
use crate::model::orders_log::OrdersLog;
use candid::Principal;
use canister_state_macros::canister_state;
use exchange_client_canister::{ExchangeId, ICDEX_EXCHANGE_ID};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod exchanges;
mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
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

    pub fn get_exchange_client(&self, exchange_id: ExchangeId) -> Option<Box<dyn Exchange>> {
        match exchange_id {
            ICDEX_EXCHANGE_ID => Some(Box::new(ICDexClient::new(
                self.env.canister_id(),
                CanisterId::from_text("3we4s-lyaaa-aaaak-aegrq-cai").unwrap(),
                self.data.icp_ledger_canister_id,
                self.data.chat_ledger_canister_id,
                10000000,
            ))),
            _ => None,
        }
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_whitelisted_trader(&self) -> bool {
        let caller = self.env.caller();
        self.data.trader_principals.contains_key(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            trader_principals: self.data.trader_principals.clone(),
            canister_ids: CanisterIds {
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                icp_ledger: self.data.icp_ledger_canister_id,
                chat_ledger: self.data.chat_ledger_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub governance_principals: HashSet<Principal>,
    pub trader_principals: HashMap<Principal, HashSet<ExchangeId>>,
    pub cycles_dispenser_canister_id: CanisterId,
    pub icp_ledger_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub orders_log: OrdersLog,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        cycles_dispenser_canister_id: CanisterId,
        icp_ledger_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            trader_principals: HashMap::new(),
            cycles_dispenser_canister_id,
            icp_ledger_canister_id,
            chat_ledger_canister_id,
            orders_log: OrdersLog::default(),
            test_mode,
        }
    }

    pub fn is_whitelisted_trader(&self, principal: Principal, exchange_id: ExchangeId) -> bool {
        self.trader_principals
            .get(&principal)
            .map(|e| e.contains(&exchange_id))
            .unwrap_or_default()
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub trader_principals: HashMap<Principal, HashSet<ExchangeId>>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub cycles_dispenser: CanisterId,
    pub icp_ledger: CanisterId,
    pub chat_ledger: CanisterId,
}
