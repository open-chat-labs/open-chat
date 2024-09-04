use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityMember, TimestampMillis, UserGroupDetails, UserId, VersionedRules};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(TimestampMillis),
    PrivateCommunity,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub members_added_or_updated: Vec<CommunityMember>,
    pub members_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub chat_rules: Option<VersionedRules>,
    pub user_groups: Vec<UserGroupDetails>,
    pub user_groups_deleted: Vec<u32>,
    pub referrals_added: Vec<UserId>,
    pub referrals_removed: Vec<UserId>,
}

impl SuccessResult {
    pub fn has_updates(&self) -> bool {
        !self.members_added_or_updated.is_empty()
            || !self.members_removed.is_empty()
            || !self.blocked_users_added.is_empty()
            || !self.blocked_users_removed.is_empty()
            || self.invited_users.is_some()
            || self.chat_rules.is_some()
    }
}
