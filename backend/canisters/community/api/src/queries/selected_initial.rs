use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityMember, EventIndex, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PrivateCommunity,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members: Vec<CommunityMember>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub chat_rules: VersionedRules,
    pub user_groups: Vec<UserGroupDetails>,
    pub referrals: Vec<UserId>,
}
