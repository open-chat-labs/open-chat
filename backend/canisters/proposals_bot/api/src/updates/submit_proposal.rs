use crate::ProposalToSubmit;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{icrc2, CanisterId};

#[ts_export(proposals_bot, submit_proposal)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal: ProposalToSubmit,
    pub transaction: icrc2::PendingCryptoTransaction,
}

#[ts_export(proposals_bot, submit_proposal)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GovernanceCanisterNotSupported,
    InsufficientPayment(u128),
    PaymentFailed(String),
    Retrying(String),
    InternalError(String),
}
