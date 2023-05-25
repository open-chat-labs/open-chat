use crate::{CommunityId, CommunityPermissions, CommunityRole, EventIndex, FrozenGroupInfo, GroupGate, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummary {
    pub community_id: CommunityId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub joined: TimestampMillis,
    pub member_count: u32,
    pub role: CommunityRole,
    pub permissions: CommunityPermissions,
    pub frozen: Option<FrozenGroupInfo>,
    pub gate: Option<GroupGate>,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PublicCommunitySummary {
    pub community_id: CommunityId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub member_count: u32,
    pub permissions: CommunityPermissions,
    pub frozen: Option<FrozenGroupInfo>,
    pub gate: Option<GroupGate>,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
}
