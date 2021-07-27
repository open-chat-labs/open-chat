use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use shared::canisters::canister_wasm::CanisterWasm;
use shared::env::Environment;
use std::cell::RefCell;

mod lifecycle;
mod model;
mod queries;
mod updates;

pub const MIN_CYCLES_BALANCE: u64 = 5_000_000_000_000; // 5T
pub const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: u64 = 150_000_000_000; // 0.15T cycles

thread_local! {
    pub static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
}

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }
}

#[derive(Default)]
pub struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub group_canister_wasm: CanisterWasm,
}
