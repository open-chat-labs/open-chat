use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, InstalledBotDetails, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[ts_export(community, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

#[ts_export(community, selected_updates)]
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(TimestampMillis),
    Error(OCError),
}

#[ts_export(community, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub members_added_or_updated: Vec<CommunityMember>,
    pub members_removed: Vec<UserId>,
    pub bots_added_or_updated: Vec<InstalledBotDetails>,
    pub bots_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub chat_rules: Option<VersionedRules>,
    pub user_groups: Vec<UserGroupDetails>,
    pub user_groups_deleted: Vec<u32>,
    pub referrals_added: Vec<UserId>,
    pub referrals_removed: Vec<UserId>,
    pub public_channel_list_updated: TimestampMillis,
}
