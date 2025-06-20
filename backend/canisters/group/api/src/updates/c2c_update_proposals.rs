use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ProposalUpdate, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub proposals: Vec<ProposalUpdate>,
}

pub type Response = UnitResult;
