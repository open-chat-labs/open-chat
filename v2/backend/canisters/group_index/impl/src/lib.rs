use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use candid::CandidType;
use serde::Deserialize;
use std::cell::RefCell;
use types::{CanisterId, CanisterWasm, ChatId, Milliseconds};
use utils::env::Environment;

#[cfg(test)]
use candid::Principal;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MIN_CYCLES_BALANCE: u64 = 5_000_000_000_000; // 5T
const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: u64 = 150_000_000_000; // 0.15T cycles
const GROUP_CANISTER_TOP_UP_AMOUNT: u64 = 100_000_000_000; // 0.1T cycles
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
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
    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_id: CanisterId,
}

impl Data {
    pub fn new(group_canister_wasm: CanisterWasm, notifications_canister_id: CanisterId) -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            group_canister_wasm,
            notifications_canister_id,
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
            group_canister_wasm: CanisterWasm::default(),
            notifications_canister_id: Principal::anonymous(),
        }
    }
}
