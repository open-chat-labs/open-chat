use serde::{Deserialize, Serialize};
use types::{CommunityId, TimestampMillis};

#[derive(Serialize, Deserialize)]
pub struct Community {
    pub community_id: CommunityId,
    pub date_joined: TimestampMillis,
}

impl Community {
    pub fn new(community_id: CommunityId, now: TimestampMillis) -> Community {
        Community {
            community_id,
            date_joined: now,
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.date_joined
    }
}
