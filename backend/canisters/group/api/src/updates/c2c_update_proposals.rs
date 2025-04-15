use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EmptySuccessOrError, ProposalUpdate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub proposals: Vec<ProposalUpdate>,
    pub correlation_id: u64,
}

pub type Response = EmptySuccessOrError;
