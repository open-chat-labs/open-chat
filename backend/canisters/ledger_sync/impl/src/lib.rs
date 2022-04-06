use crate::model::accounts::Accounts;
use crate::model::ledger_sync_state::LedgerSyncState;
use crate::model::notifications_queue::NotificationsQueue;
use crate::model::transaction_metrics::TransactionMetrics;
use candid::CandidType;
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use ic_ledger_types::BlockIndex;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;
use utils::memory;

mod lifecycle;
mod model;
mod queries;
mod updates;

const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Serialize, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
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

    pub fn metrics(&self) -> Metrics {
        let TransactionMetrics {
            deposits,
            total_deposited_e8s,
            transfers,
            total_transferred_e8s,
            withdrawals,
            total_withdrawn_e8s,
        } = self.data.transaction_metrics;

        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            deposits,
            total_deposited_e8s,
            transfers,
            total_transferred_e8s,
            withdrawals,
            total_withdrawn_e8s,
            block_index_synced_up_to: self.data.ledger_sync_state.synced_up_to(),
            last_sync_started_at: self.data.ledger_sync_state.last_sync_started_at(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub ledger_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub accounts: Accounts,
    pub notifications_queue: NotificationsQueue,
    pub ledger_sync_state: LedgerSyncState,
    pub transaction_metrics: TransactionMetrics,
    pub test_mode: bool,
}

impl Data {
    pub fn new(ledger_canister_id: CanisterId, user_index_canister_id: CanisterId, test_mode: bool) -> Data {
        Data {
            ledger_canister_id,
            user_index_canister_id,
            accounts: Accounts::default(),
            notifications_queue: NotificationsQueue::default(),
            ledger_sync_state: LedgerSyncState::default(),
            transaction_metrics: TransactionMetrics::default(),
            test_mode,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub deposits: u64,
    pub total_deposited_e8s: u128,
    pub transfers: u64,
    pub total_transferred_e8s: u128,
    pub withdrawals: u64,
    pub total_withdrawn_e8s: u128,
    pub block_index_synced_up_to: BlockIndex,
    pub last_sync_started_at: TimestampMillis,
}
