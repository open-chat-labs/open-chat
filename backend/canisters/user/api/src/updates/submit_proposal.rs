use candid::CandidType;
use proposals_bot_canister::ProposalToSubmit;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{CanisterId, Cryptocurrency};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal: ProposalToSubmit,
    pub ledger: CanisterId,
    pub token: Cryptocurrency,
    pub proposal_rejection_fee: u128,
    pub transaction_fee: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GovernanceCanisterNotSupported,
    InsufficientPayment(u128),
    UserSuspended,
    TransferFailed(String),
    Retrying(String),
    InternalError(String),
}
