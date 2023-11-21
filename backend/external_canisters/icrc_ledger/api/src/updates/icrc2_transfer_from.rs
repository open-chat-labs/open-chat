use candid::{CandidType, Nat};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use serde::Deserialize;

pub type Args = TransferFromArgs;

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Response {
    Ok(Nat),
    Err(TransferFromError),
}
