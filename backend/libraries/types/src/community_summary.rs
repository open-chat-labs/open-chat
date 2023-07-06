use crate::{
    AccessGate, ChannelId, ChatMetrics, CommunityCanisterChannelSummary, CommunityCanisterChannelSummaryUpdates, CommunityId,
    CommunityPermissions, CommunityRole, EventIndex, FrozenGroupInfo, OptionUpdate, TimestampMillis,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummary {
    pub community_id: CommunityId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    pub is_public: bool,
    pub member_count: u32,
    pub permissions: CommunityPermissions,
    pub frozen: Option<FrozenGroupInfo>,
    pub gate: Option<AccessGate>,
    pub primary_language: String,
    pub latest_event_index: EventIndex,
    pub channels: Vec<CommunityCanisterChannelSummary>,
    pub membership: Option<CommunityMembership>,
    pub metrics: ChatMetrics,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembership {
    pub joined: TimestampMillis,
    pub role: CommunityRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar_id: OptionUpdate<u128>,
    pub banner_id: OptionUpdate<u128>,
    pub is_public: Option<bool>,
    pub member_count: Option<u32>,
    pub permissions: Option<CommunityPermissions>,
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    pub gate: OptionUpdate<AccessGate>,
    pub primary_language: Option<String>,
    pub latest_event_index: Option<EventIndex>,
    pub channels_added: Vec<CommunityCanisterChannelSummary>,
    pub channels_updated: Vec<CommunityCanisterChannelSummaryUpdates>,
    pub channels_removed: Vec<ChannelId>,
    pub membership: Option<CommunityMembershipUpdates>,
    pub metrics: Option<ChatMetrics>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembershipUpdates {
    pub role: Option<CommunityRole>,
}
