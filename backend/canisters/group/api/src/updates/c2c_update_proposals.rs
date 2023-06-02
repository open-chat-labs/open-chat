use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ProposalUpdate;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub proposals: Vec<ProposalUpdate>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
}
