use candid::{CandidType, Nat, Principal};
use serde::Deserialize;
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Deserialize, Debug)]
pub struct Response {
    pub root: Option<CanisterSummary>,
    pub governance: Option<CanisterSummary>,
    pub ledger: Option<CanisterSummary>,
    pub swap: Option<CanisterSummary>,
    pub dapps: Vec<CanisterSummary>,
    pub archives: Vec<CanisterSummary>,
    pub index: Option<CanisterSummary>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct CanisterSummary {
    pub canister_id: Option<Principal>,
    pub status: Option<CanisterStatusResult>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct CanisterStatusResult {
    pub cycles: Nat,
}
