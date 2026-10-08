use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, InstalledBotDetails, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[ts_export(community, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
    // If set, the details are returned in full (`SuccessSnapshot`, holding the first page of
    // members as `selected_initial` does) when some of the updates since `updates_since` have been
    // pruned, or when more updates have been made to the members since then than that page holds
    // (`max_members`, capped at 1000 as for `selected_initial`). If not, the updates which haven't
    // been pruned are returned, as they were before clients could read `SuccessSnapshot`.
    pub max_members: Option<u32>,
}

#[ts_export(community, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(TimestampMillis),
    // Some of the updates since `updates_since` are too old to have been kept, or there are more of
    // them than the first page of members holds, so the details are returned in full instead, as
    // `selected_initial` returns them
    SuccessSnapshot(crate::selected_initial::SuccessResult),
    Error(OCError),
}

#[ts_export(community, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<CommunityMember>>", optional)]
    pub members_added_or_updated: Vec<CommunityMember>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub members_removed: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<InstalledBotDetails>>", optional)]
    pub bots_added_or_updated: Vec<InstalledBotDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub bots_removed: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub blocked_users_added: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub chat_rules: Option<VersionedRules>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserGroupDetails>>", optional)]
    pub user_groups: Vec<UserGroupDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<u32>>", optional)]
    pub user_groups_deleted: Vec<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub referrals_added: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub referrals_removed: Vec<UserId>,
    pub public_channel_list_updated: Option<TimestampMillis>,
}
