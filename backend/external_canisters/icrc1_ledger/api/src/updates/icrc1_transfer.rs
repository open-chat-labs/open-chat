use candid::Nat;
use types::icrc1::{TransferArg, TransferError};

pub type Args = TransferArg;
pub type Response = Result<Nat, TransferError>;
