use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CommunityId, CyclesTopUp, Version};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalCommunityMap {
    communities: HashMap<CommunityId, LocalCommunity>,
}

impl LocalCommunityMap {
    pub fn add(&mut self, community_id: CommunityId, wasm_version: Version) {
        let community = LocalCommunity::new(wasm_version);
        self.communities.insert(community_id, community);
    }

    pub fn delete(&mut self, community_id: &CommunityId) -> bool {
        self.communities.remove(community_id).is_some()
    }

    pub fn get(&self, community_id: &CommunityId) -> Option<&LocalCommunity> {
        self.communities.get(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut LocalCommunity> {
        self.communities.get_mut(community_id)
    }

    pub fn mark_cycles_top_up(&mut self, community_id: &CommunityId, top_up: CyclesTopUp) -> bool {
        if let Some(community) = self.communities.get_mut(community_id) {
            community.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&CommunityId, &LocalCommunity)> {
        self.communities.iter()
    }

    pub fn len(&self) -> usize {
        self.communities.len()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct LocalCommunity {
    pub wasm_version: Version,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalCommunity {
    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<Version>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }
}

impl LocalCommunity {
    pub fn new(wasm_version: Version) -> LocalCommunity {
        LocalCommunity {
            wasm_version,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
        }
    }
}
