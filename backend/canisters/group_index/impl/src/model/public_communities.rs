#![allow(dead_code)]
use super::private_communities::PrivateCommunityInfo;
use crate::MARK_ACTIVE_DURATION;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CommunityId, FrozenCommunityInfo, PublicCommunityActivity, TimestampMillis};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "PublicCommunitiesTrimmed")]
pub struct PublicCommunities {
    communities: HashMap<CommunityId, PublicCommunityInfo>,
    #[serde(skip)]
    name_to_id_map: CaseInsensitiveHashMap<CommunityId>,
    communities_pending: CaseInsensitiveHashMap<TimestampMillis>,
}

impl PublicCommunities {
    pub fn len(&self) -> usize {
        self.communities.len()
    }

    pub fn get(&self, community_id: &CommunityId) -> Option<&PublicCommunityInfo> {
        self.communities.get(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut PublicCommunityInfo> {
        self.communities.get_mut(community_id)
    }

    pub fn reserve_name(&mut self, name: &str, now: TimestampMillis) -> bool {
        if self.name_to_id_map.contains_key(name) || self.communities_pending.contains_key(name) {
            false
        } else {
            self.communities_pending.insert(name, now);
            true
        }
    }

    pub fn handle_community_created(
        &mut self,
        community_id: CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        now: TimestampMillis,
    ) -> bool {
        if self.communities_pending.remove(&name).is_some() {
            self.name_to_id_map.insert(&name, community_id);
            let community_info = PublicCommunityInfo::new(community_id, name, description, avatar_id, now);
            self.communities.insert(community_id, community_info);
            true
        } else {
            false
        }
    }

    pub fn handle_community_creation_failed(&mut self, name: &str) {
        self.communities_pending.remove(name);
    }

    pub fn update_community(
        &mut self,
        community_id: &CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
    ) -> UpdateCommunityResult {
        match self.communities.get_mut(community_id) {
            None => UpdateCommunityResult::CommunityNotFound,
            Some(mut community) => {
                if community.name != name {
                    if self.name_to_id_map.contains_key(&name) || self.communities_pending.contains_key(&name) {
                        return UpdateCommunityResult::NameTaken;
                    }
                    self.name_to_id_map.remove(&community.name);
                    self.name_to_id_map.insert(&name, *community_id);
                }

                community.name = name;
                community.description = description;
                community.avatar_id = avatar_id;
                UpdateCommunityResult::Success
            }
        }
    }

    pub fn delete(&mut self, community_id: &CommunityId) -> Option<PublicCommunityInfo> {
        if let Some(community) = self.communities.remove(community_id) {
            self.name_to_id_map.remove(&community.name);
            Some(community)
        } else {
            None
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicCommunityInfo> {
        self.communities.values()
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct PublicCommunityInfo {
    // Fields common to PrivateCommunityInfo
    id: CommunityId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenCommunityInfo>,

    // Fields particular to PublicCommunityInfo
    name: String,
    description: String,
    avatar_id: Option<u128>,
    activity: PublicCommunityActivity,
}

pub enum UpdateCommunityResult {
    Success,
    CommunityNotFound,
    NameTaken,
}

impl PublicCommunityInfo {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        now: TimestampMillis,
    ) -> PublicCommunityInfo {
        PublicCommunityInfo {
            id,
            name,
            description,
            avatar_id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            activity: PublicCommunityActivity::default(),
            frozen: None,
        }
    }

    pub fn id(&self) -> CommunityId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis, activity: PublicCommunityActivity) {
        self.marked_active_until = until;
        self.activity = activity;
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

impl From<PublicCommunityInfo> for PrivateCommunityInfo {
    fn from(public_community_info: PublicCommunityInfo) -> Self {
        let mut private_community_info = PrivateCommunityInfo::new(public_community_info.id, public_community_info.created);
        private_community_info.mark_active(public_community_info.marked_active_until);
        private_community_info.set_frozen(public_community_info.frozen);
        private_community_info
    }
}

#[derive(Deserialize)]
struct PublicCommunitiesTrimmed {
    communities: HashMap<CommunityId, PublicCommunityInfo>,
    communities_pending: CaseInsensitiveHashMap<TimestampMillis>,
}

impl From<PublicCommunitiesTrimmed> for PublicCommunities {
    fn from(value: PublicCommunitiesTrimmed) -> Self {
        let mut public_communities = PublicCommunities {
            communities: value.communities,
            communities_pending: value.communities_pending,
            ..Default::default()
        };

        for (community_id, community) in public_communities.communities.iter() {
            public_communities.name_to_id_map.insert(&community.name, *community_id);
        }

        public_communities
    }
}
