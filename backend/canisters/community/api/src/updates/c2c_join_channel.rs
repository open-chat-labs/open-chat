use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary, GateCheckFailedReason, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
    pub is_platform_moderator: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterChannelSummary>),
    SuccessJoinedCommunity(Box<CommunityCanisterCommunitySummary>),
    AlreadyInChannel(Box<CommunityCanisterChannelSummary>),
    GateCheckFailed(GateCheckFailedReason),
    UserNotInCommunity,
    ChannelNotFound,
    UserSuspended,
    UserBlocked,
    MemberLimitReached(u32),
    CommunityFrozen,
    NotInvited,
    InternalError(String),
}
