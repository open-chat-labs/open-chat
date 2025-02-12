use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{InstalledBotDetails, CommunityMember, PublicApiKeyDetails, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

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
    pub members_added_or_updated: Vec<CommunityMember>,
    pub members_removed: Vec<UserId>,
    pub bots_added_or_updated: Vec<InstalledBotDetails>,
    pub bots_removed: Vec<UserId>,
    pub api_keys_generated: Vec<PublicApiKeyDetails>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub chat_rules: Option<VersionedRules>,
    pub user_groups: Vec<UserGroupDetails>,
    pub user_groups_deleted: Vec<u32>,
    pub referrals_added: Vec<UserId>,
    pub referrals_removed: Vec<UserId>,
}
