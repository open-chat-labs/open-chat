use candid::CandidType;
use ic_ledger_types::{BlockIndex, Tokens, TransferError};
use serde::{Deserialize, Serialize};
use types::{icrc1, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub amount: Tokens,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(BlockIndex),
    TransferError(TransferError),
    TransferErrorV2(icrc1::TransferError),
    InternalError(String),
}
