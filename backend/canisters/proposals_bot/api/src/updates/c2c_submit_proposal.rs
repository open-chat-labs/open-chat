use crate::ProposalToSubmit;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, icrc1};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal: ProposalToSubmit,
    pub transaction: icrc1::CompletedCryptoTransaction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GovernanceCanisterNotSupported,
    InsufficientPayment(u128),
    Retrying(String),
    InternalError(String),
}
