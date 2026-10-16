use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, VecDeque};
use types::{CommunityId, DeletedCommunityInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct DeletedCommunities {
    communities: HashMap<CommunityId, DeletedCommunityInfo>,
    // The members still to be told of each deletion by the job which the user canister events
    // queue replaced, moved onto the queue in post_upgrade
    // TODO: remove once released
    #[serde(default)]
    pending_community_deleted_notifications: VecDeque<(CommunityId, UserId)>,
}

impl DeletedCommunities {
    pub fn get(&self, community_id: &CommunityId) -> Option<&DeletedCommunityInfo> {
        self.communities.get(community_id)
    }

    // Records the community as deleted, unless it already is
    pub fn insert(&mut self, deleted_community: DeletedCommunityInfo) -> bool {
        match self.communities.entry(deleted_community.id) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(deleted_community);
                true
            }
        }
    }

    // One-off: the notifications still pending when the user canister events queue replaced the
    // job which sent them, each with the deleted community it is of
    // TODO: remove once released
    pub fn take_pending_notifications(&mut self) -> Vec<(UserId, DeletedCommunityInfo)> {
        std::mem::take(&mut self.pending_community_deleted_notifications)
            .into_iter()
            .filter_map(|(community_id, user_id)| self.communities.get(&community_id).map(|d| (user_id, d.clone())))
            .collect()
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

        Metrics { public, private }
    }
}

pub struct Metrics {
    pub public: u64,
    pub private: u64,
}
