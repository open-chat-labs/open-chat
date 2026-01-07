use crate::user_groups::UserGroupSummary;
use crate::{
    AccessGateConfig, CanisterId, ChannelId, ChatMetrics, CommunityCanisterChannelSummary,
    CommunityCanisterChannelSummaryUpdates, CommunityId, CommunityPermissions, CommunityRole, EventIndex, FrozenGroupInfo,
    OptionUpdate, TimestampMillis,
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
    pub is_public: Option<bool>,
    pub member_count: u32,
    pub permissions: CommunityPermissions,
    pub frozen: Option<FrozenGroupInfo>,
    pub gate_config: Option<AccessGateConfig>,
    pub primary_language: String,
    pub latest_event_index: EventIndex,
    pub channels: Vec<CommunityCanisterChannelSummary>,
    pub membership: Option<CommunityMembership>,
    pub user_groups: Option<Vec<UserGroupSummary>>,
    pub is_invited: Option<bool>,
    pub metrics: ChatMetrics,
    pub verified: Option<bool>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembership {
    pub joined: TimestampMillis,
    pub role: Option<CommunityRole>,
    pub rules_accepted: Option<bool>,
    pub display_name: Option<String>,
    pub lapsed: Option<bool>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterCommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    #[ts(as = "Option<crate::OptionUpdateU128>")]
    pub avatar_id: Option<OptionUpdate<u128>>,
    #[ts(as = "Option<crate::OptionUpdateU128>")]
    pub banner_id: Option<OptionUpdate<u128>>,
    pub is_public: Option<bool>,
    pub member_count: Option<u32>,
    pub permissions: Option<CommunityPermissions>,
    #[ts(as = "Option<crate::OptionUpdateFrozenGroupInfo>")]
    pub frozen: Option<OptionUpdate<FrozenGroupInfo>>,
    #[ts(as = "Option<crate::OptionUpdateAccessGateConfig>")]
    pub gate_config: Option<OptionUpdate<AccessGateConfig>>,
    pub primary_language: Option<String>,
    pub latest_event_index: Option<EventIndex>,
    pub channels_added: Option<Vec<CommunityCanisterChannelSummary>>,
    pub channels_updated: Option<Vec<CommunityCanisterChannelSummaryUpdates>>,
    pub channels_removed: Option<Vec<ChannelId>>,
    pub membership: Option<CommunityMembershipUpdates>,
    pub user_groups: Option<Vec<UserGroupSummary>>,
    pub user_groups_deleted: Option<Vec<u32>>,
    pub metrics: Option<ChatMetrics>,
    pub verified: Option<bool>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembershipUpdates {
    pub role: Option<CommunityRole>,
    pub rules_accepted: Option<bool>,
    #[ts(as = "Option<crate::OptionUpdateString>")]
    pub display_name: Option<OptionUpdate<String>>,
    pub lapsed: Option<bool>,
}
