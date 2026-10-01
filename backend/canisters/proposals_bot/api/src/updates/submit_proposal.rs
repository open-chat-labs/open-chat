use crate::ProposalToSubmit;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, icrc2};

#[ts_export(proposals_bot, submit_proposal)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub proposal: ProposalToSubmit,
    // The fee, which the ProposalsBot pulls via ICRC2. It must be from the caller's wallet (their
    // User canister's account, or their principal's for a user in a MultiUser canister), which must
    // have approved the ProposalsBot, and to the ProposalsBot's own account.
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
