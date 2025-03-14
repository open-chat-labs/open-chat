use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex};

#[ts_export(community, register_proposal_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_index: MessageIndex,
    pub adopt: bool,
}

#[ts_export(community, register_proposal_vote)]
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
    UserLapsed,
    Error(OCError),
}
