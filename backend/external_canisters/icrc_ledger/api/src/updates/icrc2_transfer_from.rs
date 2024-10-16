use candid::Nat;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use types::icrc2::TransferFromError;

pub type Args = TransferFromArgs;
pub type Response = Result<Nat, TransferFromError>;
