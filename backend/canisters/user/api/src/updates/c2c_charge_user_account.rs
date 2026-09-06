use ic_ledger_types::{BlockIndex, TransferError};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::nns::Tokens;
use types::{CanisterId, UserId, icrc1, icrc2};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // The user being charged. The canister cannot derive this itself - from its own id it can only
    // reach the user at index 0 - and it determines which subaccount pays (or for ICRC-2, whose
    // approval is spent).
    pub user_id: UserId,
    pub ledger_canister_id: CanisterId,
    pub amount: Tokens,
    // The account to charge, defaulting to this canister's own. Any other account must have
    // approved this canister as spender, since the payment is then pulled via ICRC-2.
    pub from_account: Option<icrc1::Account>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(BlockIndex),
    TransferError(TransferError),
    TransferErrorV2(icrc_ledger_types::icrc1::transfer::TransferError),
    TransferFromError(icrc2::TransferFromError),
    InternalError(String),
    Error(OCError),
}
