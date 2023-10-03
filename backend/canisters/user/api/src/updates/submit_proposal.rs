use candid::CandidType;
use proposals_bot_canister::ProposalToSubmit;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal: ProposalToSubmit,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GovernanceCanisterNotSupported,
    Unauthorized,
    UserSuspended,
    TransferFailed(String),
    Retrying(String),
    InternalError(String),
}
