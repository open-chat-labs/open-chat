use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityCanisterChannelSummary, GateCheckFailedReason};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterChannelSummary>),
    AlreadyInChannel(Box<CommunityCanisterChannelSummary>),
    GateCheckFailed(GateCheckFailedReason),
    UserNotInCommunity,
    ChannelNotFound,
    UserSuspended,
    UserBlocked,
    UserLimitReached(u32),
    CommunityFrozen,
    NotInvited,
    InternalError(String),
}
