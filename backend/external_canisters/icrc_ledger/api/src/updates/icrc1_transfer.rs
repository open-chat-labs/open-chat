use candid::Nat;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

pub type Args = TransferArg;
pub type Response = Result<Nat, TransferError>;
