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
        self.manager(canister_type).get()
    }

    pub fn set(&mut self, canister_type: ChildCanisterType, wasm: CanisterWasm) {
        self.manager_mut(canister_type).set(wasm);
    }

    fn manager(&self, canister_type: ChildCanisterType) -> &CanisterWasmManager {
        match canister_type {
            ChildCanisterType::LocalUserIndex => &self.local_user_index,
            ChildCanisterType::User => &self.user,
        }
    }

    fn manager_mut(&mut self, canister_type: ChildCanisterType) -> &mut CanisterWasmManager {
        match canister_type {
            ChildCanisterType::LocalUserIndex => &mut self.local_user_index,
            ChildCanisterType::User => &mut self.user,
        }
    }
}
