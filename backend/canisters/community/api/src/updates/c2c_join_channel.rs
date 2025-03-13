use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    ChannelId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary, GateCheckFailedReason, TimestampMillis,
    UniquePersonProof, UserId, UserType, VerifiedCredentialGateArgs,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
    pub referred_by: Option<UserId>,
    pub is_platform_moderator: bool,
    pub user_type: UserType,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
    pub unique_person_proof: Option<UniquePersonProof>,
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
