use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityMember, EventIndex, GroupRules, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: EventIndex,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(EventIndex),
    CallerNotInCommunity,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members_added_or_updated: Vec<CommunityMember>,
    pub members_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub rules: Option<GroupRules>,
}
