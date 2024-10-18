use crate::user_groups::UserGroupSummary;
use crate::{
    AccessGate, AccessGateConfig, CanisterId, ChannelId, ChatMetrics, CommunityCanisterChannelSummary,
    CommunityCanisterChannelSummaryUpdates, CommunityId, CommunityPermissions, CommunityRole, EventIndex, FrozenGroupInfo,
    OptionUpdate, TimestampMillis,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
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
    pub gate_config: Option<AccessGateConfig>,
    pub primary_language: String,
    pub latest_event_index: EventIndex,
    pub channels: Vec<CommunityCanisterChannelSummary>,
    pub membership: Option<CommunityMembership>,
    pub user_groups: Vec<UserGroupSummary>,
    pub is_invited: Option<bool>,
    pub metrics: ChatMetrics,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembership {
    pub joined: TimestampMillis,
    pub role: CommunityRole,
    pub rules_accepted: bool,
    pub display_name: Option<String>,
    pub lapsed: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    #[ts(as = "crate::OptionUpdateU128")]
    pub avatar_id: OptionUpdate<u128>,
    #[ts(as = "crate::OptionUpdateU128")]
    pub banner_id: OptionUpdate<u128>,
    pub is_public: Option<bool>,
    pub member_count: Option<u32>,
    pub permissions: Option<CommunityPermissions>,
    #[ts(as = "crate::OptionUpdateFrozenGroupInfo")]
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    #[ts(as = "crate::OptionUpdateAccessGate")]
    pub gate: OptionUpdate<AccessGate>,
    #[ts(as = "crate::OptionUpdateAccessGateConfig")]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub primary_language: Option<String>,
    pub latest_event_index: Option<EventIndex>,
    #[ts(skip_if_default)]
    pub channels_added: Vec<CommunityCanisterChannelSummary>,
    #[ts(skip_if_default)]
    pub channels_updated: Vec<CommunityCanisterChannelSummaryUpdates>,
    #[ts(skip_if_default)]
    pub channels_removed: Vec<ChannelId>,
    pub membership: Option<CommunityMembershipUpdates>,
    #[ts(skip_if_default)]
    pub user_groups: Vec<UserGroupSummary>,
    #[ts(skip_if_default)]
    pub user_groups_deleted: Vec<u32>,
    pub metrics: Option<ChatMetrics>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembershipUpdates {
    pub role: Option<CommunityRole>,
    pub rules_accepted: Option<bool>,
    #[ts(as = "crate::OptionUpdateString")]
    pub display_name: OptionUpdate<String>,
    pub lapsed: Option<bool>,
}
