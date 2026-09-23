use ic_ledger_types::{BlockIndex, TransferError};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::nns::Tokens;
use types::{CanisterId, UserId, icrc1, icrc2};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // The user being charged. The canister cannot derive this itself, since from its own id it can
    // only reach the user at index 0.
    pub user_id: UserId,
    pub ledger_canister_id: CanisterId,
    pub amount: Tokens,
    // The account to charge, defaulting to the user's wallet. A User canister charges its own account
    // directly, and pulls from any other via ICRC-2, which that account must have approved. A
    // MultiUser canister's users hold their own funds, so it always pulls via ICRC-2, spending only
    // an approval made under the user's own spender subaccount (see `ledger_utils::multi_user_spender_subaccount`).
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
