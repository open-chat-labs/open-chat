#![allow(dead_code)]
use crate::MARK_ACTIVE_DURATION;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{CommunityId, FrozenCommunityInfo, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct PrivateCommunities {
    communities: HashMap<CommunityId, PrivateCommunityInfo>,
}

impl PrivateCommunities {
    pub fn len(&self) -> usize {
        self.communities.len()
    }

    pub fn get(&self, community_id: &CommunityId) -> Option<&PrivateCommunityInfo> {
        self.communities.get(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut PrivateCommunityInfo> {
        self.communities.get_mut(community_id)
    }

    pub fn add(&mut self, community: PrivateCommunityInfo) -> bool {
        match self.communities.entry(community.id) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(community);
                true
            }
        }
    }

    pub fn delete(&mut self, community_id: &CommunityId) -> bool {
        self.communities.remove(community_id).is_some()
    }

    pub fn iter(&self) -> impl Iterator<Item = &PrivateCommunityInfo> {
        self.communities.values()
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct PrivateCommunityInfo {
    id: CommunityId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenCommunityInfo>,
}

impl PrivateCommunityInfo {
    pub fn new(id: CommunityId, now: TimestampMillis) -> PrivateCommunityInfo {
        PrivateCommunityInfo {
            id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            frozen: None,
        }
    }

    pub fn id(&self) -> CommunityId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn frozen_info(&self) -> Option<&FrozenCommunityInfo> {
        self.frozen.as_ref()
    }

    pub fn set_frozen(&mut self, info: Option<FrozenCommunityInfo>) {
        self.frozen = info;
    }
}
