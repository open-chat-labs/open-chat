use candid::Deserialize;
use group_index_canister::ChildCanisterType;
use serde::Serialize;
use types::{CanisterWasm, CanisterWasmManager, Hash};

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
        self.manager(canister_type).get()
    }

    pub fn set(&mut self, canister_type: ChildCanisterType, wasm: CanisterWasm) {
        self.manager_mut(canister_type).set(wasm);
    }

    pub fn push_chunk(&mut self, canister_type: ChildCanisterType, chunk: Vec<u8>, index: u8) -> Result<Hash, u8> {
        self.manager_mut(canister_type).push_chunk(chunk, index)
    }

    pub fn wasm_from_chunks(&self, canister_type: ChildCanisterType) -> Vec<u8> {
        self.manager(canister_type).wasm_from_chunks()
    }

    pub fn chunks_hash(&self, canister_type: ChildCanisterType) -> Hash {
        self.manager(canister_type).chunks_hash()
    }

    fn manager(&self, canister_type: ChildCanisterType) -> &CanisterWasmManager {
        match canister_type {
            ChildCanisterType::LocalGroupIndex => &self.local_group_index,
            ChildCanisterType::Group => &self.group,
            ChildCanisterType::Community => &self.community,
        }
    }

    fn manager_mut(&mut self, canister_type: ChildCanisterType) -> &mut CanisterWasmManager {
        match canister_type {
            ChildCanisterType::LocalGroupIndex => &mut self.local_group_index,
            ChildCanisterType::Group => &mut self.group,
            ChildCanisterType::Community => &mut self.community,
        }
    }
}
