use candid::{CandidType, Nat};
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};
use serde::Deserialize;

pub type Args = ApproveArgs;

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Response {
    Ok(Nat),
    Err(ApproveError),
}
