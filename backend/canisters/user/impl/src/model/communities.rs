use crate::model::community::Community;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CanisterId, CommunityId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Communities {
    communities_created: u32,
    communities: HashMap<CommunityId, Community>,
    removed: Vec<RemovedCommunity>,
}

#[derive(Serialize, Deserialize)]
struct RemovedCommunity {
    community_id: CommunityId,
    timestamp: TimestampMillis,
}

impl Communities {
    pub fn exists(&self, community_id: &CommunityId) -> bool {
        self.communities.contains_key(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut Community> {
        self.communities.get_mut(community_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.communities.values().any(|c| c.last_updated() > since)
            || self.removed.last().map(|g| g.timestamp > since).unwrap_or_default()
    }

    pub fn create(
        &mut self,
        community_id: CommunityId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> bool {
        self.join(community_id, local_user_index_canister_id, now);
        self.communities_created += 1;
        true
    }

    pub fn join(
        &mut self,
        community_id: CommunityId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> (&mut Community, bool) {
        let index = self.next_index();
        match self.communities.entry(community_id) {
            Vacant(e) => {
                self.removed.retain(|c| c.community_id != community_id);
                (
                    e.insert(Community::new(community_id, local_user_index_canister_id, index, now)),
                    true,
                )
            }
            Occupied(e) => (e.into_mut(), false),
        }
    }

    pub fn remove(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        self.removed.retain(|c| c.community_id != community_id);
        self.removed.push(RemovedCommunity {
            community_id,
            timestamp: now,
        });
        self.communities.remove(&community_id)
    }

    pub fn updated_since(&self, updated_since: TimestampMillis) -> impl Iterator<Item = &Community> {
        self.communities.values().filter(move |c| c.last_updated() > updated_since)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Community> {
        self.communities.values()
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<CommunityId> {
        self.removed
            .iter()
            .rev()
            .take_while(|c| c.timestamp > timestamp)
            .map(|c| c.community_id)
            .collect()
    }

    pub fn communities_created(&self) -> u32 {
        self.communities_created
    }

    pub fn len(&self) -> usize {
        self.communities.len()
    }

    pub fn removed_len(&self) -> usize {
        self.removed.len()
    }

    fn next_index(&self) -> u32 {
        self.communities.values().map(|c| c.index.value).max().unwrap_or_default() + 1
    }
}
