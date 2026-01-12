use crate::user_groups::UserGroupSummary;
use crate::{
    AccessGateConfig, CanisterId, ChannelId, ChatMetrics, CommunityCanisterChannelSummary,
    CommunityCanisterChannelSummaryUpdates, CommunityId, CommunityPermissions, CommunityRole, EventIndex, FrozenGroupInfo,
    OptionUpdate, TimestampMillis, is_default,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummary {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_public: bool,
    pub member_count: u32,
    pub permissions: CommunityPermissions,
    pub frozen: Option<FrozenGroupInfo>,
    pub gate_config: Option<AccessGateConfig>,
    pub primary_language: String,
    pub latest_event_index: EventIndex,
    pub channels: Vec<CommunityCanisterChannelSummary>,
    pub membership: Option<CommunityMembership>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserGroupSummary>>", optional)]
    pub user_groups: Vec<UserGroupSummary>,
    pub is_invited: Option<bool>,
    pub metrics: ChatMetrics,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub verified: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembership {
    pub joined: TimestampMillis,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<CommunityRole>", optional)]
    pub role: CommunityRole,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub rules_accepted: bool,
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub lapsed: bool,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateU128>", optional)]
    pub avatar_id: OptionUpdate<u128>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateU128>", optional)]
    pub banner_id: OptionUpdate<u128>,
    pub is_public: Option<bool>,
    pub member_count: Option<u32>,
    pub permissions: Option<CommunityPermissions>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateFrozenGroupInfo>", optional)]
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateAccessGateConfig>", optional)]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub primary_language: Option<String>,
    pub latest_event_index: Option<EventIndex>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<CommunityCanisterChannelSummary>>", optional)]
    pub channels_added: Vec<CommunityCanisterChannelSummary>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<CommunityCanisterChannelSummaryUpdates>>", optional)]
    pub channels_updated: Vec<CommunityCanisterChannelSummaryUpdates>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<ChannelId>>", optional)]
    pub channels_removed: Vec<ChannelId>,
    pub membership: Option<CommunityMembershipUpdates>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserGroupSummary>>", optional)]
    pub user_groups: Vec<UserGroupSummary>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<u32>>", optional)]
    pub user_groups_deleted: Vec<u32>,
    pub metrics: Option<ChatMetrics>,
    pub verified: Option<bool>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembershipUpdates {
    pub role: Option<CommunityRole>,
    pub rules_accepted: Option<bool>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateString>", optional)]
    pub display_name: OptionUpdate<String>,
    pub lapsed: Option<bool>,
}
