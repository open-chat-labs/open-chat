use crate::model::canisters_requiring_upgrade::CanistersRequiringUpgrade;
use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::Deserialize;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, CanisterWasm, ChatId, Cycles, Milliseconds};
use utils::canister;
use utils::env::Environment;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MIN_CYCLES_BALANCE: Cycles = 5_000_000_000_000; // 5T
const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = 150_000_000_000; // 0.15T cycles
const GROUP_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
}

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub service_principals: HashSet<Principal>,
    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub test_mode: bool,
}

impl Data {
    fn new(
        service_principals: Vec<Principal>,
        group_canister_wasm: CanisterWasm,
        notifications_canister_id: CanisterId,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            service_principals: service_principals.into_iter().collect(),
            group_canister_wasm,
            notifications_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            test_mode,
        }
    }

    pub fn chat_exists(&self, chat_id: &ChatId) -> bool {
        self.private_groups.get(chat_id).is_some() || self.public_groups.get(chat_id).is_some()
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            service_principals: HashSet::default(),
            group_canister_wasm: CanisterWasm::default(),
            notifications_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(5),
            test_mode: true,
        }
    }
}
