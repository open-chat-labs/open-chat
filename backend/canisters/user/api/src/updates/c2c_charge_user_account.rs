use candid::CandidType;
use ic_ledger_types::{BlockIndex, TransferError};
use serde::{Deserialize, Serialize};
use types::ICP;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub amount: ICP,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(BlockIndex),
    TransferError(TransferError),
    InternalError(String),
}
