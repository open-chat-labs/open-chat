use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, ProposalDecisionStatus, ProposalRewardStatus, Tally};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub proposals: Vec<ProposalUpdate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ProposalUpdate {
    pub message_id: MessageId,
    pub status: Option<ProposalDecisionStatus>,
    pub reward_status: Option<ProposalRewardStatus>,
    pub latest_tally: Option<Tally>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
}
