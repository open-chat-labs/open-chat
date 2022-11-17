use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageIndex;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
    pub adopt: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyVoted(bool),
    CallerNotInGroup,
    NoEligibleNeurons,
    ProposalMessageNotFound,
    ProposalNotFound,
    ProposalNotAcceptingVotes,
    UserSuspended,
    InternalError(String),
}
