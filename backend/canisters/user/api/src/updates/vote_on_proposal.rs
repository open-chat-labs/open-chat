use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, ChatId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal_id: u64,
    pub adopt: bool,
    pub chat_id: ChatId,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    NoEligibleNeurons,
    ProposalNotFound,
    ProposalNotAcceptingVotes,
    InternalError(String),
}
