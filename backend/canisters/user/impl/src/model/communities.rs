#![allow(dead_code)]
use crate::model::community::Community;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{CommunityId, TimestampMillis};

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
    pub fn get(&self, community_id: &CommunityId) -> Option<&Community> {
        self.communities.get(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut Community> {
        self.communities.get_mut(community_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.communities.values().any(|c| c.last_updated() > since)
            || self.removed.last().map(|g| g.timestamp > since).unwrap_or_default()
    }

    pub fn create(&mut self, community_id: CommunityId, now: TimestampMillis) -> bool {
        self.join(community_id, now);
        self.communities_created += 1;
        true
    }

    pub fn join(&mut self, community_id: CommunityId, now: TimestampMillis) -> bool {
        match self.communities.entry(community_id) {
            Vacant(e) => {
                e.insert(Community::new(community_id, now));
                self.removed.retain(|c| c.community_id != community_id);
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn remove(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        let community = self.communities.remove(&community_id);
        if community.is_some() {
            self.removed.push(RemovedCommunity {
                community_id,
                timestamp: now,
            });
        }
        community
    }

    pub fn exists(&self, community_id: &CommunityId) -> bool {
        self.communities.contains_key(community_id)
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

    pub fn has(&self, community_id: &CommunityId) -> bool {
        self.communities.contains_key(community_id)
    }
}
