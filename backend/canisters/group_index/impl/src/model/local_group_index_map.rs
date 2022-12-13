use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CanisterId, ChatId, CyclesTopUp, Version};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct LocalGroupIndexMap {
    index_map: HashMap<CanisterId, LocalGroupIndex>,
    group_to_index: HashMap<ChatId, CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct LocalGroupIndex {
    pub group_count: u32,
    pub full: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
    pub wasm_version: Version,
}

impl LocalGroupIndexMap {
    pub fn add_index(&mut self, index_id: CanisterId) -> bool {
        self.index_map.insert(index_id, LocalGroupIndex::default()).is_none()
    }

    pub fn add_group(&mut self, index_id: CanisterId, chat_id: ChatId) -> bool {
        if let Some(index) = self.index_map.get_mut(&index_id) {
            if self.group_to_index.insert(chat_id, index_id).is_some() {
                index.group_count += 1;
                return true;
            }
        }

        false
    }

    pub fn mark_cycles_top_up(&mut self, index_id: CanisterId, top_up: CyclesTopUp) -> bool {
        if let Some(index) = self.index_map.get_mut(&index_id) {
            index.cycle_top_ups.push(top_up);
            true
        } else {
            false
        }
    }

    pub fn set_wasm_version(&mut self, index_id: CanisterId, wasm_version: Version) -> bool {
        if let Some(index) = self.index_map.get_mut(&index_id) {
            index.wasm_version = wasm_version;
            true
        } else {
            false
        }
    }

    pub fn next_index(&self) -> Option<CanisterId> {
        self.index_map
            .iter()
            .filter(|(_, v)| !v.full)
            .min_by_key(|(_, v)| v.group_count)
            .map(|(k, _)| *k)
    }

    pub fn index_exists(&self, index_id: &CanisterId) -> bool {
        self.index_map.contains_key(index_id)
    }

    pub fn get_index(&self, index_id: &CanisterId) -> Option<&LocalGroupIndex> {
        self.index_map.get(index_id)
    }

    pub fn canisters(&self) -> impl Iterator<Item = &CanisterId> {
        self.index_map.keys()
    }
}
