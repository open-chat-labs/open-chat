use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub is_nns: bool,
    pub governance_canister_id: CanisterId,
    pub proposal_id: u64,
    pub adopt: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoEligibleNeurons,
    ProposalNotFound,
    ProposalNotAcceptingVotes,
    InternalError(String),
    Error(OCError),
}
