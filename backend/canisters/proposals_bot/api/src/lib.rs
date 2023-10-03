use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::icrc1::Account;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ProposalToSubmit {
    pub title: String,
    pub summary: String,
    pub url: String,
    pub action: ProposalToSubmitAction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum ProposalToSubmitAction {
    Motion,
    TransferSnsTreasuryFunds(TransferSnsTreasuryFunds),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TransferSnsTreasuryFunds {
    pub icp: bool,
    pub amount: u128,
    pub to: Account,
    pub memo: Option<u64>,
}

mod lifecycle;
mod updates;

pub use lifecycle::*;
pub use updates::*;
