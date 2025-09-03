use ic_ledger_types::{BlockIndex, TransferError};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::CanisterId;
use types::nns::Tokens;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub amount: Tokens,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(BlockIndex),
    TransferError(TransferError),
    TransferErrorV2(icrc_ledger_types::icrc1::transfer::TransferError),
    InternalError(String),
    Error(OCError),
}
