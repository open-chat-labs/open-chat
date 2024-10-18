use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[ts_export(community, selected_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

#[ts_export(community, selected_updates)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(TimestampMillis),
    PrivateCommunity,
}

#[ts_export(community, selected_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    #[ts(skip_if_default)]
    pub members_added_or_updated: Vec<CommunityMember>,
    #[ts(skip_if_default)]
    pub members_removed: Vec<UserId>,
    #[ts(skip_if_default)]
    pub blocked_users_added: Vec<UserId>,
    #[ts(skip_if_default)]
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub chat_rules: Option<VersionedRules>,
    #[ts(skip_if_default)]
    pub user_groups: Vec<UserGroupDetails>,
    #[ts(skip_if_default)]
    pub user_groups_deleted: Vec<u32>,
    #[ts(skip_if_default)]
    pub referrals_added: Vec<UserId>,
    #[ts(skip_if_default)]
    pub referrals_removed: Vec<UserId>,
}
