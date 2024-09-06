use candid::CandidType;
use proposals_bot_canister::ProposalToSubmit;
use std::fmt::Debug;
use ts_export::ts_export;
use types::{CanisterId, Cryptocurrency};

#[ts_export(user, submit_proposal)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal: ProposalToSubmit,
    pub ledger: CanisterId,
    pub token: Cryptocurrency,
    pub proposal_rejection_fee: u128,
    pub transaction_fee: u128,
}

#[ts_export(user, submit_proposal)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    GovernanceCanisterNotSupported,
    InsufficientPayment(u128),
    UserSuspended,
    TransferFailed(String),
    Retrying(String),
    InternalError(String),
}
