use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChannelId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary, CommunityId, GateCheckFailedReason,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterChannelSummary>),
    SuccessJoinedCommunity(Box<CommunityCanisterCommunitySummary>),
    AlreadyInChannel(Box<CommunityCanisterChannelSummary>),
    GateCheckFailed(GateCheckFailedReason),
    CommunityNotFound,
    CommunityNotPublic,
    ChannelNotFound,
    MemberLimitReached(u32),
    UserBlocked,
    UserSuspended,
    CommunityFrozen,
    NotInvited,
    InternalError(String),
}
