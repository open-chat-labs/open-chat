use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, ProposalUpdate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub proposals: Vec<ProposalUpdate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
}
