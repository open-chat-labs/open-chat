use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CanisterId, ChatId, Version};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct LocalGroupIndexMap {
    index_map: HashMap<CanisterId, LocalGroupIndex>,
    group_to_index: HashMap<ChatId, CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct LocalGroupIndex {
    group_count: u32,
    full: bool,
    wasm_version: Version,
}

impl LocalGroupIndexMap {
    pub fn add_index(&mut self, index_id: CanisterId, wasm_version: Version) -> bool {
        let exists = self.index_map.contains_key(&index_id);
        if !exists {
            self.index_map.insert(
                index_id,
                LocalGroupIndex {
                    group_count: 0,
                    full: false,
                    wasm_version,
                },
            );
        }
        !exists
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

    pub fn index_for_new_group(&self) -> Option<CanisterId> {
        self.index_map
            .iter()
            .filter(|(_, v)| !v.full)
            .min_by_key(|(_, v)| v.group_count)
            .map(|(k, _)| *k)
    }

    pub fn contains_key(&self, index_id: &CanisterId) -> bool {
        self.index_map.contains_key(index_id)
    }

    pub fn get(&self, index_id: &CanisterId) -> Option<&LocalGroupIndex> {
        self.index_map.get(index_id)
    }

    pub fn get_mut(&mut self, index_id: &CanisterId) -> Option<&mut LocalGroupIndex> {
        self.index_map.get_mut(index_id)
    }

    pub fn canisters(&self) -> impl Iterator<Item = &CanisterId> {
        self.index_map.keys()
    }

    pub fn get_index_canister(&self, chat_id: &ChatId) -> Option<CanisterId> {
        self.group_to_index.get(chat_id).copied()
    }
}

impl LocalGroupIndex {
    pub fn set_wasm_version(&mut self, wasm_version: Version) {
        self.wasm_version = wasm_version;
    }

    pub fn mark_full(&mut self) {
        self.full = true;
    }

    pub fn wasm_version(&self) -> Version {
        self.wasm_version
    }
}
