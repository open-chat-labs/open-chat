use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, EventIndex, InstalledBotDetails, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[ts_export(community, selected_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

#[ts_export(community, selected_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, selected_initial)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<CommunityMember>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<InstalledBotDetails>>", optional)]
    pub bots: Vec<InstalledBotDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub basic_members: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub blocked_users: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub invited_users: Vec<UserId>,
    #[serde(default, skip_serializing_if = "VersionedRules::is_empty")]
    #[ts(as = "Option<VersionedRules>", optional)]
    pub chat_rules: VersionedRules,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserGroupDetails>>", optional)]
    pub user_groups: Vec<UserGroupDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub referrals: Vec<UserId>,
    pub public_channel_list_updated: TimestampMillis,
}
