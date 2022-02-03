use candid::CandidType;
use ic_ledger_types::{BlockIndex, TransferError};
use serde::Deserialize;
use types::ICP;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub amount: ICP,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(BlockIndex),
    TransferError(TransferError),
    InternalError(String),
}
