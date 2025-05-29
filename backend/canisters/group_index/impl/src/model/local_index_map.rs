use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, CanisterId, ChatId, CommunityId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct LocalIndexMap {
    index_map: HashMap<CanisterId, LocalIndex>,
    group_to_index: HashMap<ChatId, CanisterId>,
    community_to_index: HashMap<CommunityId, CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct LocalIndex {
    group_count: u32,
    community_count: u32,
    full: bool,
    wasm_version: BuildVersion,
}

impl LocalIndexMap {
    pub fn add_index(&mut self, index_id: CanisterId) -> bool {
        let exists = self.index_map.contains_key(&index_id);
        if !exists {
            self.index_map.insert(
                index_id,
                LocalIndex {
                    group_count: 0,
                    community_count: 0,
                    full: false,
                    wasm_version: BuildVersion::default(),
                },
            );
        }
        !exists
    }

    pub fn add_group(&mut self, index_id: CanisterId, chat_id: ChatId) -> bool {
        if let Some(index) = self.index_map.get_mut(&index_id) {
            if self.group_to_index.insert(chat_id, index_id).is_none() {
                index.group_count += 1;
                return true;
            }
        }

        false
    }

    pub fn add_community(&mut self, index_id: CanisterId, community_id: CommunityId) -> bool {
        if let Some(index) = self.index_map.get_mut(&index_id) {
            if self.community_to_index.insert(community_id, index_id).is_none() {
                index.community_count += 1;
                return true;
            }
        }

        false
    }

    pub fn index_for_new_community(&self) -> Option<CanisterId> {
        self.index_map
            .iter()
            .filter(|(_, v)| !v.full)
            .min_by_key(|(_, v)| v.community_count)
            .map(|(k, _)| *k)
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

    pub fn get_mut(&mut self, index_id: &CanisterId) -> Option<&mut LocalIndex> {
        self.index_map.get_mut(index_id)
    }

    pub fn canisters(&self) -> impl Iterator<Item = &CanisterId> {
        self.index_map.keys()
    }

    pub fn get_index_canister_for_group(&self, chat_id: &ChatId) -> Option<CanisterId> {
        self.group_to_index.get(chat_id).copied()
    }

    pub fn get_index_canister_for_community(&self, community_id: &CommunityId) -> Option<CanisterId> {
        self.community_to_index.get(community_id).copied()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&CanisterId, &LocalIndex)> {
        self.index_map.iter()
    }

    pub fn mark_group_deleted(&mut self, chat_id: &ChatId) {
        if let Some(index) = self.group_to_index.remove(chat_id).and_then(|i| self.index_map.get_mut(&i)) {
            index.group_count = index.group_count.saturating_sub(1);
        }
    }

    pub fn mark_community_deleted(&mut self, community_id: &CommunityId) {
        if let Some(index) = self
            .community_to_index
            .remove(community_id)
            .and_then(|i| self.index_map.get_mut(&i))
        {
            index.community_count = index.community_count.saturating_sub(1);
        }
    }
}

impl LocalIndex {
    pub fn set_wasm_version(&mut self, wasm_version: BuildVersion) {
        self.wasm_version = wasm_version;
    }

    pub fn set_full(&mut self, full: bool) {
        self.full = full;
    }

    pub fn wasm_version(&self) -> BuildVersion {
        self.wasm_version
    }
}
