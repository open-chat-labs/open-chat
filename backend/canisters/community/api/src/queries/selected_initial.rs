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
    pub bots: Vec<InstalledBotDetails>,
    pub basic_members: Vec<UserId>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub chat_rules: VersionedRules,
    pub user_groups: Vec<UserGroupDetails>,
    pub referrals: Vec<UserId>,
    pub public_channel_list_updated: TimestampMillis,
}
