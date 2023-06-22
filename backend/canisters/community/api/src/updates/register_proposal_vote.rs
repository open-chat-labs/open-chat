use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_index: MessageIndex,
    pub adopt: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyVoted(bool),
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    NoEligibleNeurons,
    ProposalMessageNotFound,
    ProposalNotFound,
    ProposalNotAcceptingVotes,
    InternalError(String),
}
