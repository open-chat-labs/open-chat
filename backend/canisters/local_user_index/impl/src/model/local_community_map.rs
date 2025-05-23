use local_user_index_canister::LocalCommunity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, CommunityId, CyclesTopUp, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalCommunityMap {
    communities: HashMap<CommunityId, LocalCommunity>,
}

impl LocalCommunityMap {
    pub fn add_existing(&mut self, community_id: CommunityId, community: LocalCommunity) {
        self.communities.insert(community_id, community);
    }

    pub fn add(&mut self, community_id: CommunityId, wasm_version: BuildVersion) {
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

    pub fn contains(&self, community_id: &CommunityId) -> bool {
        self.communities.contains_key(community_id)
    }

    pub fn mark_activity(&mut self, community_id: &CommunityId, timestamp: TimestampMillis) -> bool {
        if let Some(community) = self.communities.get_mut(community_id) {
            community.latest_activity = timestamp;
            true
        } else {
            false
        }
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
