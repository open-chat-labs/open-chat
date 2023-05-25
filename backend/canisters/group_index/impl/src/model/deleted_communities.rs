#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, VecDeque};
use types::{CommunityId, DeletedCommunityInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct DeletedCommunities {
    communities: HashMap<CommunityId, DeletedCommunityInfo>,
    pending_community_deleted_notifications: VecDeque<(CommunityId, UserId)>,
}

impl DeletedCommunities {
    pub fn get(&self, community_id: &CommunityId) -> Option<&DeletedCommunityInfo> {
        self.communities.get(community_id)
    }

    pub fn insert(&mut self, deleted_community: DeletedCommunityInfo, members: Vec<UserId>) -> bool {
        let community_id = deleted_community.id;

        match self.communities.entry(community_id) {
            Occupied(_) => false,
            Vacant(e) => {
                let deleted_by = deleted_community.deleted_by;
                for user_id in members.into_iter().filter(|u| *u != deleted_by) {
                    self.pending_community_deleted_notifications
                        .push_back((community_id, user_id));
                }
                e.insert(deleted_community);
                true
            }
        }
    }

    pub fn dequeue_community_deleted_notification(&mut self) -> Option<(UserId, DeletedCommunityInfo)> {
        self.pending_community_deleted_notifications
            .pop_front()
            .and_then(|(community_id, user_id)| self.communities.get(&community_id).map(|d| (user_id, d.clone())))
    }

    pub fn notifications_pending(&self) -> usize {
        self.pending_community_deleted_notifications.len()
    }

    pub fn metrics(&self) -> Metrics {
        let mut public = 0;
        let mut private = 0;
        for community in self.communities.values() {
            if community.public {
                public += 1;
            } else {
                private += 1;
            }
        }

        Metrics {
            public,
            private,
            notifications_pending: self.pending_community_deleted_notifications.len() as u64,
        }
    }
}

pub struct Metrics {
    pub public: u64,
    pub private: u64,
    pub notifications_pending: u64,
}
