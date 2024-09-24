use candid::Deserialize;
use group_index_canister::ChildCanisterType;
use serde::Serialize;
use types::{CanisterWasm, CanisterWasmManager};

#[derive(Serialize, Deserialize, Default)]
pub struct ChildCanisterWasms {
    local_group_index: CanisterWasmManager,
    group: CanisterWasmManager,
    community: CanisterWasmManager,
}

impl ChildCanisterWasms {
    pub fn new(local_group_index: CanisterWasm, group: CanisterWasm, community: CanisterWasm) -> ChildCanisterWasms {
        ChildCanisterWasms {
            local_group_index: CanisterWasmManager::new(local_group_index),
            group: CanisterWasmManager::new(group),
            community: CanisterWasmManager::new(community),
        }
    }

    pub fn get(&self, canister_type: ChildCanisterType) -> &CanisterWasm {
        match canister_type {
            ChildCanisterType::LocalGroupIndex => self.local_group_index.get(),
            ChildCanisterType::Group => self.group.get(),
            ChildCanisterType::Community => self.community.get(),
        }
    }

    pub fn set(&mut self, canister_type: ChildCanisterType, wasm: CanisterWasm) {
        match canister_type {
            ChildCanisterType::LocalGroupIndex => self.local_group_index.set(wasm),
            ChildCanisterType::Group => self.group.set(wasm),
            ChildCanisterType::Community => self.community.set(wasm),
        }
    }
}
