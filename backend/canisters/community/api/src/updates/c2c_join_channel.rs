use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    ChannelId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary, GateCheckFailedReason, TimestampMillis,
    UserId, VerifiedCredentialGateArgs,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
    pub is_platform_moderator: bool,
    pub is_bot: bool,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
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
