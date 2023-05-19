use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CommunitySummary, GateCheckFailedReason, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub invite_code: Option<u64>,
    pub is_platform_moderator: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunitySummary>),
    AlreadyInCommunity(Box<CommunitySummary>),
    GateCheckFailed(GateCheckFailedReason),
    NotInvited,
    Blocked,
    MemberLimitReached(u32),
    CommunityFrozen,
    InternalError(String),
}
