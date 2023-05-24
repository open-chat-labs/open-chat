use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CommunitySummary, GateCheckFailedReason, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<ChannelSummary>),
    AlreadyInCommunity(Box<ChannelSummary>),
    GateCheckFailed(GateCheckFailedReason),
    MemberLimitReached(u32),
    CommunityFrozen,
}
