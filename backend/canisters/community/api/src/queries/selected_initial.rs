use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, EventIndex, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[ts_export(community, selected_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

#[ts_export(community, selected_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PrivateCommunity,
}

#[ts_export(community, selected_initial)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<CommunityMember>,
    pub basic_members: Vec<UserId>,
    #[ts(skip_if_default)]
    pub blocked_users: Vec<UserId>,
    #[ts(skip_if_default)]
    pub invited_users: Vec<UserId>,
    pub chat_rules: VersionedRules,
    #[ts(skip_if_default)]
    pub user_groups: Vec<UserGroupDetails>,
    #[ts(skip_if_default)]
    pub referrals: Vec<UserId>,
}
