use candid::Deserialize;
use serde::Serialize;
use types::{CanisterWasm, CanisterWasmManager};
use user_index_canister::ChildCanisterType;

#[derive(Serialize, Deserialize, Default)]
pub struct ChildCanisterWasms {
    local_user_index: CanisterWasmManager,
    user: CanisterWasmManager,
}

impl ChildCanisterWasms {
    pub fn new(local_user_index: CanisterWasm, user: CanisterWasm) -> ChildCanisterWasms {
        ChildCanisterWasms {
            local_user_index: CanisterWasmManager::new(local_user_index),
            user: CanisterWasmManager::new(user),
        }
    }

    pub fn get(&self, canister_type: ChildCanisterType) -> &CanisterWasm {
        match canister_type {
            ChildCanisterType::LocalUserIndex => self.local_user_index.get(),
            ChildCanisterType::User => self.local_user_index.get(),
        }
    }

    pub fn set(&mut self, canister_type: ChildCanisterType, wasm: CanisterWasm) {
        match canister_type {
            ChildCanisterType::LocalUserIndex => self.local_user_index.set(wasm),
            ChildCanisterType::User => self.local_user_index.set(wasm),
        }
    }
}
