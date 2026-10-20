use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CommunityId, DeletedCommunityInfo};

#[derive(Serialize, Deserialize, Default)]
pub struct DeletedCommunities {
    communities: HashMap<CommunityId, DeletedCommunityInfo>,
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
