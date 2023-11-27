use crate::user_groups::UserGroupSummary;
use crate::{
    local_user_index_canister_id, AccessGate, CanisterId, ChannelId, ChatMetrics, CommunityCanisterChannelSummary,
    CommunityCanisterChannelSummaryUpdates, CommunityId, CommunityPermissions, CommunityRole, EventIndex, FrozenGroupInfo,
    OptionUpdate, TimestampMillis,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[serde(from = "CommunityCanisterCommunitySummaryPrevious")]
pub struct CommunityCanisterCommunitySummary {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
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
    pub user_groups: Vec<UserGroupSummary>,
    pub metrics: ChatMetrics,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummaryPrevious {
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
    pub user_groups: Vec<UserGroupSummary>,
    pub metrics: ChatMetrics,
}

impl From<CommunityCanisterCommunitySummaryPrevious> for CommunityCanisterCommunitySummary {
    fn from(value: CommunityCanisterCommunitySummaryPrevious) -> Self {
        CommunityCanisterCommunitySummary {
            community_id: value.community_id,
            local_user_index_canister_id: local_user_index_canister_id(value.community_id.into()),
            last_updated: value.last_updated,
            name: value.name,
            description: value.description,
            avatar_id: value.avatar_id,
            banner_id: value.banner_id,
            is_public: value.is_public,
            member_count: value.member_count,
            permissions: value.permissions,
            frozen: value.frozen,
            gate: value.gate,
            primary_language: value.primary_language,
            latest_event_index: value.latest_event_index,
            channels: value.channels,
            membership: value.membership,
            user_groups: value.user_groups,
            metrics: value.metrics,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembership {
    pub joined: TimestampMillis,
    pub role: CommunityRole,
    pub rules_accepted: bool,
    pub display_name: Option<String>,
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
    pub user_groups: Vec<UserGroupSummary>,
    pub user_groups_deleted: Vec<u32>,
    pub metrics: Option<ChatMetrics>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembershipUpdates {
    pub role: Option<CommunityRole>,
    pub rules_accepted: Option<bool>,
    pub display_name: OptionUpdate<String>,
}
