use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::MessageIndex;

#[ts_export(group, register_proposal_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
    pub adopt: bool,
}

#[ts_export(group, register_proposal_vote)]
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
    ChatFrozen,
    InternalError(String),
}
